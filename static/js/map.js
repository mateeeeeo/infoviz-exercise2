let mapWidth = 800;
let mapHeight = 500;
let map = null;
let mapData = null;
let mapLookup = {};
let scatterDotsLookup = {};
let fullDataGlobal = null;
let selectedCountryCode = null;
let brushedCountries = new Set();
let pcaDataGlobal = null; // for brush operations
let currentYear = 2020; // slider
let dataLookupGlobal = null; // for map updates
let updateMapFunction = null;
let tooltip = null;

function initMap(fullData) {
    tooltip = d3.select("#tooltip");

    if (typeof fullData === 'string') {
        fullData = JSON.parse(fullData);
    }

    if (!Array.isArray(fullData) && typeof fullData === 'object') {
        let arr = [];
        let colName = Object.keys(fullData);
        let firstCol = colName[0];

        let rowIdx = Object.keys(fullData[firstCol]);

        rowIdx.forEach(idx => {
            let newRow = {};
            colName.forEach(col => {
                newRow[col] = fullData[col][idx];
            });
            arr.push(newRow);
        });

        fullData = arr;
    }

    fullDataGlobal = fullData;


    const excludeCols = ["Country Name", "Country Code", "year"];
    const numFeatures = Object.keys(fullData[0]).filter(k =>
        !excludeCols.includes(k) && typeof fullData[0][k] === 'number'
    );

    const select = d3.select("#indicator_change");
    select.selectAll("option").remove();
    numFeatures.forEach(f => {
        select.append("option").text(f).attr("value", f);
    });

    const dataLookup = {};
    fullData.forEach(d => {
        dataLookup[d["Country Code"]] = d;
    });

    dataLookupGlobal = dataLookup;
    d3.json("../static/data/world-topo.json").then(function (countries) {
        let projection = d3.geoEqualEarth()
            .scale(180)
            .translate([mapWidth / 2, mapHeight / 2]);

        let path = d3.geoPath()
            .projection(projection);

        let svg = d3.select("#svg_map")
            .attr("width", mapWidth)
            .attr("height", mapHeight);

        mapData = topojson.feature(countries, countries.objects.countries).features;

        map = svg.append("g")
            .selectAll('path')
            .data(mapData)
            .enter().append('path')
            .attr('d', path)
            .attr('id', d => {
                let code = d.properties ? d.properties.id : null;
                return code ? `map-${code}` : null;
            })
            .attr('stroke', 'black')
            .attr('stroke-width', 0.5)
            .attr('fill', 'white')
            .attr('data-country-code', d => d.properties ? d.properties.id : null);

        map.each(function (d) {
            let countryCode = d.properties ? d.properties.id : null;
            if (countryCode) {
                mapLookup[countryCode] = d3.select(this);
            }
        });

        map.style("cursor", "pointer")
            .on("mouseover", function (event, d) {
                let countryCode = null;
                if (d.properties) {
                    console.log();
                    countryCode = d.properties.id
                } else {
                    return;
                }
                if (countryCode && scatterDotsLookup[countryCode]) {
                    scatterDotsLookup[countryCode]
                        .attr("r", 8)
                        .attr("fill", "red");
                }


                const data = dataLookupGlobal[d.properties.id];
                if(!data) return; 
                let i = 0;
                let htmlStr = `Country Name: ${data["Country Name"]}<br/>`;
                for (const [key, value] of Object.entries(data)) {
                    if (key === "Country Name") {
                        continue;
                    }

                    htmlStr += `${key}: ${value}<br/>`;

                    if (i > 8) {
                        break;
                    }
                    i++;
                }
                tooltip.html(htmlStr);
                tooltip.style("opacity", 1);
            })
            .on("mousemove", (event, d) => {
                tooltip.style("left", (event.pageX + 8) + "px").style("top", (event.pageY + 8) + "px")
            })
            .on("mouseout", function (event, d) {
                let countryCode = d.properties ? d.properties.id : null;
                if (countryCode && scatterDotsLookup[countryCode]) {
                    scatterDotsLookup[countryCode]
                        .attr("r", 5)
                        .attr("fill", "steelblue");
                }
                tooltip.style("opacity", 0);
            })
            .on("click", function (event, d) {
                let countryCode = d.properties ? d.properties.id : null;
                let countryName = null;

                fullDataGlobal.forEach(row => {
                    if (row["Country Code"] === countryCode) {
                        countryName = row["Country Name"];
                    }
                });

                if (countryName) {
                    selectedCountryCode = countryCode;
                    renderLineChart(countryName, countryCode);
                }
            })
            ;


        function updateMap(feature) {
            let yearFilteredData = fullData.filter(d => d["year"] === currentYear);
            const extent = d3.extent(yearFilteredData, d => d[feature]);
            const colorScale = d3.scaleSequential(d3.interpolateBlues).domain(extent);
            const dataLookup = {};
            yearFilteredData.forEach(d => {
                dataLookup[d["Country Code"]] = d;
            });

            dataLookupGlobal = dataLookup;
            
            map.attr("fill", d => {
                    let countryCode = d.properties ? d.properties.id : null;
                    let yearData = fullData.find(row =>
                        row["Country Code"] === countryCode && row["year"] === currentYear
                    );
                    if (yearData && yearData[feature] != null) {
                        return colorScale(yearData[feature]);
                    }
                    return "#ccc";
                });
        }

        updateMapFunction = updateMap;
        updateMap(select.property("value"));

        select.on("change", function () {
            updateMap(this.value);
            if (selectedCountryCode) {
                let countryName = null;
                fullDataGlobal.forEach(row => {
                    if (row["Country Code"] === selectedCountryCode) {
                        countryName = row["Country Name"];
                    }
                });
                if (countryName) {
                    renderLineChart(countryName, selectedCountryCode);
                }
            }
        });

        d3.select("#year_slider").on("input", function () {
            currentYear = parseInt(this.value);
            d3.select("#year_label").text(currentYear);
            updateMap(select.property("value"));

            if (selectedCountryCode) {
                let countryName = null;
                fullDataGlobal.forEach(row => {
                    if (row["Country Code"] === selectedCountryCode) {
                        countryName = row["Country Name"];
                    }
                });
                if (countryName) {
                    renderLineChart(countryName, selectedCountryCode);
                }
            }

            if (brushedCountries.size > 0) {
                renderMultiLineChart(Array.from(brushedCountries));
            }
        });
    });
}

function initScatter(pcaData) {
    pcaDataGlobal = pcaData;

    const margin = { top: 20, right: 20, bottom: 40, left: 40 };
    const svg = d3.select("#svg_plot");
    const width = +svg.attr("width") - margin.left - margin.right;
    const height = +svg.attr("height") - margin.top - margin.bottom;
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
        .domain([-10, 10]).nice()
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain([-10, 10]).nice()
        .range([height, 0]);

    g.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x));

    g.append("g")
        .call(d3.axisLeft(y));

    const dots = g.selectAll("circle")
        .data(pcaData)
        .enter()
        .append("circle")
        .attr("cx", d => x(d[0]))
        .attr("cy", d => y(d[1]))
        .attr("r", 5)
        .attr("fill", "steelblue")
        .style("cursor", "pointer")
        .on("mouseover", function (event, d) {
            if (!brushedCountries.has(d["Country Code"])) {
                d3.select(this)
                    .attr("r", 8)
                    .attr("fill", "red");
                tooltip.html("Country Name: " + d["Country Name"]);
                tooltip.style("opacity", 1);

                let countryCode = d["Country Code"];
                if (countryCode && mapLookup[countryCode]) {
                    mapLookup[countryCode]
                        .attr("fill", "orange")
                        .attr("stroke-width", 2)
                        .attr("stroke", "red");
                }
            }
        })
        .on("mousemove", function (event) {
            tooltip
                .style("left", (event.pageX + 8) + "px")
                .style("top", (event.pageY + 8) + "px");
        })
        .on("mouseout", function (event, d) {
            if (!brushedCountries.has(d["Country Code"])) {
                d3.select(this)
                    .attr("r", 5)
                    .attr("fill", "steelblue");
                tooltip.style("opacity", 0);

                let countryCode = d["Country Code"];
                if (countryCode && mapLookup[countryCode]) {
                    mapLookup[countryCode]
                        .attr("fill", "white")
                        .attr("stroke-width", 0.5)
                        .attr("stroke", "black");
                }
            }
        });

    dots.each(function (d) {
        let countryCode = d["Country Code"];
        if (countryCode) {
            scatterDotsLookup[countryCode] = d3.select(this);
        }
    });

    const brush = d3.brush()
        .extent([[0, 0], [width, height]])
        .on("brush", brushed)
        .on("end", brushEnd);

    g.append("g")
        .attr("class", "brush")
        .call(brush);

    g.selectAll("circle").raise(); // for tooltip to work, scatterplot dots are above overlay


    function brushed(event) {
        if (!event.selection) return;

        const [[x0, y0], [x1, y1]] = event.selection;
        brushedCountries.clear();
        dots.attr("fill", d => {
            return "steelblue";
        }).attr("r", 5);

        d3.selectAll("path").attr("fill", "white")
            .attr("stroke-width", 0.5)
            .attr("stroke", "black");

        dots.each(function (d) {
            const px = x(d[0]);
            const py = y(d[1]);

            if (px >= x0 && px <= x1 && py >= y0 && py <= y1) {
                brushedCountries.add(d["Country Code"]);
            }
        });

        dots.attr("fill", d => {
            if (brushedCountries.has(d["Country Code"])) {
                return "red";
            }
            return "steelblue";
        }).attr("r", d => {
            if (brushedCountries.has(d["Country Code"])) {
                return 8;
            }
            return 5;
        });

        brushedCountries.forEach(countryCode => {
            if (mapLookup[countryCode]) {
                mapLookup[countryCode]
                    .attr("fill", "orange")
                    .attr("stroke-width", 2)
                    .attr("stroke", "red");
            }
        });

        if (brushedCountries.size > 0) {
            renderMultiLineChart(Array.from(brushedCountries));
        }
    }

    function brushEnd(event) {
        if (!event.selection) {
            brushedCountries.clear();

            dots.attr("fill", "steelblue")
                .attr("r", 5);

            d3.selectAll("path").attr("fill", "white")
                .attr("stroke-width", 0.5)
                .attr("stroke", "black");
            d3.select("#svg_line_plot").html("");
        }
    }
}

function renderLineChart(countryName, countryCode) {
    let countryData = fullDataGlobal.filter(d => d["Country Code"] === countryCode);

    if (countryData.length === 0) {
        return;
    }

    countryData.sort((a, b) => a["year"] - b["year"]);
    let indicator = d3.select("#indicator_change").property("value");;
    let lineData = countryData.map(d => ({
        year: d["year"],
        value: d[indicator]
    })).filter(d => d.value != null && !isNaN(d.value));
    if (lineData.length === 0) {
        return;
    }

    let container = d3.select("#svg_line_plot");
    const margin = { top: 40, right: 30, bottom: 40, left: 70 };
    const width = 900 - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    let svg = container.selectAll("svg").data([null])

    svg.exit().remove();
    svg = svg.enter()
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .merge(svg);

    let title = svg.selectAll(".chart-title").data([null]);
    title.exit().remove();
    title.enter()
        .append("text")
        .attr("class", "chart-title")
        .merge(title)
        .attr("x", (width + margin.left + margin.right) / 2)
        .attr("y", 25)
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
        .style("font-weight", "bold")
        .text(`${countryName} - ${indicator} (1960-2020)`)

    let g = svg.selectAll(".chart-group").data([null]);
    g = g.enter()
        .append("g")
        .attr("class", "chart-group")
        .attr("transform", `translate(${margin.left},${margin.top})`)
        .merge(g);
    const yMin = Math.min(0, d3.min(lineData, d => d.value));
    const yMax = d3.max(lineData, d => d.value);

    const xScale = d3.scaleLinear()
        .domain(d3.extent(lineData, d => d.year))
        .range([0, width]);
    const yScale = d3.scaleLinear()
        .domain([yMin, yMax * 1.1])
        .range([height, 0]);

    const line = d3.line()
        .x(d => xScale(d.year))
        .y(d => yScale(d.value));

    let xAxis = g.selectAll(".x-axis").data([null]);
    xAxis.exit().remove();
    xAxis = xAxis.enter()
        .append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${height})`)
        .merge(xAxis)
        .call(d3.axisBottom(xScale).tickFormat(d3.format("d")));

    xAxis.selectAll(".x-label").data([null]).enter()
        .append("text")
        .attr("class", "x-label")
        .attr("x", width / 2)
        .attr("y", 35)
        .attr("fill", "black")
        .style("text-anchor", "middle")
        .style("font-size", "12px")
        .text("Year")

    let yAxis = g.selectAll(".y-axis").data([null]);
    yAxis.exit().remove();
    yAxis = yAxis.enter()
        .append("g")
        .attr("class", "y-axis")
        .merge(yAxis)
        .call(d3.axisLeft(yScale));

    yAxis.selectAll(".y-label").data([null]).enter()
        .append("text")
        .attr("class", "y-label")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left + 10)
        .attr("x", 0 - (height / 2))
        .attr("dy", "1em")
        .attr("fill", "black")
        .style("text-anchor", "middle")
        .style("font-size", "12px")
        .text(indicator);

    let path = g.selectAll(".line-path").data([lineData]);
    path.exit().remove();
    path.enter()
        .append("path")
        .attr("class", "line-path")
        .merge(path)
        .transition()
        .duration(500)
        .attr("fill", "none")
        .attr("stroke", "steelblue")
        .attr("stroke-width", 2.5)
        .attr("stroke-linecap", "round")
        .attr("d", line);

    let circles = g.selectAll(".dot").data(lineData, (d, i) => i);
    circles.exit().remove();
    circles.enter()
        .append("circle")
        .attr("class", "dot")
        .merge(circles)
        .transition()
        .duration(500)
        .attr("cx", d => xScale(d.year))
        .attr("cy", d => yScale(d.value))
        .attr("r", 3)
        .attr("fill", "steelblue");
}

function renderMultiLineChart(countryCodes) {
    let allCountryData = [];
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);
    let colorIndex = 0;

    countryCodes.forEach(countryCode => {
        let countryData = fullDataGlobal.filter(d => d["Country Code"] === countryCode);

        if (countryData.length > 0) {
            let countryName = countryData[0]["Country Name"];
            countryData.sort((a, b) => a["year"] - b["year"]);

            let indicator = d3.select("#indicator_change").property("value");

            let lineData = countryData.map(d => ({
                year: d["year"],
                value: d[indicator],
                country: countryName,
                countryCode: countryCode,
                color: colorScale(colorIndex++)
            })).filter(d => d.value != null && !isNaN(d.value));

            allCountryData = allCountryData.concat(lineData);
        }
    });

    if (allCountryData.length === 0) {
        return;
    }

    let container = d3.select("#svg_line_plot");
    const margin = { top: 40, right: 30, bottom: 40, left: 70 };
    const width = 900 - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    let svg = container.selectAll("svg").data([null]);
    svg.exit().remove();
    svg = svg.enter()
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .merge(svg);

    const indicator = d3.select("#indicator_change").property("value");
    let title = svg.selectAll(".chart-title").data([null]);
    title.exit().remove();
    title.enter()
        .append("text")
        .attr("class", "chart-title")
        .merge(title)
        .attr("x", (width + margin.left + margin.right) / 2)
        .attr("y", 25)
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
        .style("font-weight", "bold")
        .text(`Brushed Countries - ${indicator} (1960-2020)`);

    let g = svg.selectAll(".chart-group").data([null]);
    g = g.enter()
        .append("g")
        .attr("class", "chart-group")
        .attr("transform", `translate(${margin.left},${margin.top})`)
        .merge(g);

    const yMin = Math.min(0, d3.min(allCountryData, d => d.value));
    const yMax = d3.max(allCountryData, d => d.value);

    const xScale = d3.scaleLinear()
        .domain(d3.extent(allCountryData, d => d.year))
        .range([0, width]);

    const yScale = d3.scaleLinear()
        .domain([yMin, yMax * 1.1])
        .range([height, 0]);

    const line = d3.line()
        .x(d => xScale(d.year))
        .y(d => yScale(d.value));

    let xAxis = g.selectAll(".x-axis").data([null]);
    xAxis.exit().remove();
    xAxis = xAxis.enter()
        .append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${height})`)
        .merge(xAxis)
        .call(d3.axisBottom(xScale).tickFormat(d3.format("d")));

    xAxis.selectAll(".x-label").data([null]).enter()
        .append("text")
        .attr("class", "x-label")
        .attr("x", width / 2)
        .attr("y", 35)
        .attr("fill", "black")
        .style("text-anchor", "middle")
        .style("font-size", "12px")
        .text("Year");

    let yAxis = g.selectAll(".y-axis").data([null]);
    yAxis.exit().remove();
    yAxis = yAxis.enter()
        .append("g")
        .attr("class", "y-axis")
        .merge(yAxis)
        .call(d3.axisLeft(yScale));

    yAxis.selectAll(".y-label").data([null]).enter()
        .append("text")
        .attr("class", "y-label")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left + 10)
        .attr("x", 0 - (height / 2))
        .attr("dy", "1em")
        .attr("fill", "black")
        .style("text-anchor", "middle")
        .style("font-size", "12px")
        .text(indicator);
    const groupedData = d3.group(allCountryData, d => d.country)
    let paths = g.selectAll(".line-path").data(Array.from(groupedData.entries()), d => d[0])
    paths.exit().remove();
    paths.enter()
        .append("path")
        .attr("class", "line-path")
        .merge(paths)
        .transition()
        .duration(500)
        .attr("fill", "none")
        .attr("stroke", d => d[1][0].color)
        .attr("stroke-width", 2.5)
        .attr("stroke-linecap", "round")
        .attr("d", d => line(d[1]));
    let circles = g.selectAll(".dot").data(allCountryData, (d, i) => i);
    circles.exit().remove();
    circles.enter()
        .append("circle")
        .attr("class", "dot")
        .merge(circles)
        .transition()
        .duration(500)
        .attr("cx", d => xScale(d.year))
        .attr("cy", d => yScale(d.value))
        .attr("r", 2)
        .attr("fill", d => d.color);
    let legendGroup = g.selectAll(".legend-group").data([null]);
    legendGroup.exit().remove();
    legendGroup = legendGroup.enter()
        .append("g")
        .attr("class", "legend-group")
        .attr("font-family", "sans-serif")
        .attr("font-size", 10)
        .attr("text-anchor", "end")
        .merge(legendGroup);

    let legend = legendGroup.selectAll(".legend-item").data(Array.from(groupedData.keys()), d => d);
    legend.exit().remove();
    let legendEnter = legend.enter()
        .append("g")
        .attr("class", "legend-item");

    legendEnter.merge(legend)
        .attr("transform", (d, i) => `translate(0,${i * 20})`);
    legendEnter.append("rect")
        .merge(legend.select("rect"))
        .attr("x", width - 19)
        .attr("width", 19)
        .attr("height", 19)
        .attr("fill", (d) => groupedData.get(d)[0].color)
    legendEnter.append("text")
        .merge(legend.select("text"))
        .attr("x", width - 24)
        .attr("y", 9.5)
        .attr("dy", "0.32em")
        .text(d => d);
}

