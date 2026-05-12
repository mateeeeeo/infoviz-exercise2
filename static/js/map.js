let mapWidth = 800;
let mapHeight = 500;
let map = null;
let mapData = null;
let mapLookup = {}; 
let scatterDotsLookup = {}; 
let fullDataGlobal = null;
let selectedCountryCode = null; // track selected country
let brushedCountries = new Set(); // track brushed countries
let pcaDataGlobal = null; // store PCA data globally for brush operations
let currentYear = 2020; // current year for slider
let dataLookupGlobal = null; // store data lookup for map updates
let updateMapFunction = null; // store update map function for indicator changes 


function initMap(fullData) {
    
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
    
    // Store dataLookup globally for year slider updates
    dataLookupGlobal = dataLookup;

    // loads the world map as topojson
    d3.json("../static/data/world-topo.json").then(function (countries) {

        // defines the map projection method and scales the map within the SVG
        let projection = d3.geoEqualEarth()
            .scale(180)
            .translate([mapWidth / 2, mapHeight / 2]);

        // generates the path coordinates from topojson
        let path = d3.geoPath()
            .projection(projection);

        // configures the SVG element
        let svg = d3.select("#svg_map")
            .attr("width", mapWidth)
            .attr("height", mapHeight);

        // map geometry
        mapData = topojson.feature(countries, countries.objects.countries).features;

        // generates and styles the SVG path
        map = svg.append("g")
            .selectAll('path')
            .data(mapData)
            .enter().append('path')
            .attr('d', path)
            .attr('stroke', 'black')
            .attr('stroke-width', 0.5)
            .attr('fill', 'white')
            .attr('data-country-code', d => d.properties ? d.properties.id : null);

        map.each(function(d) {
            let countryCode = d.properties ? d.properties.id : null;
            if (countryCode) {
                mapLookup[countryCode] = d3.select(this);
            }
        });

        map.style("cursor", "pointer")
            .on("mouseover", function(event, d) {
                let countryCode = d.properties ? d.properties.id : null;
                if (countryCode && scatterDotsLookup[countryCode]) {
                    // Highlight the dot in the scatterplot
                    scatterDotsLookup[countryCode]
                        .attr("r", 8)
                        .attr("fill", "red");
                }
            })
            .on("mouseout", function(event, d) {
                let countryCode = d.properties ? d.properties.id : null;
                if (countryCode && scatterDotsLookup[countryCode]) {
                    // Reset the dot
                    scatterDotsLookup[countryCode]
                        .attr("r", 5)
                        .attr("fill", "steelblue");
                }
            })
            .on("click", function(event, d) {
                let countryCode = d.properties ? d.properties.id : null;
                let countryName = null;
                
                // Find the country name from full data
                fullDataGlobal.forEach(row => {
                    if (row["Country Code"] === countryCode) {
                        countryName = row["Country Name"];
                    }
                });
                
                if (countryName) {
                    selectedCountryCode = countryCode;
                    renderLineChart(countryName, countryCode);
                }
            });


        // Create updateMap function with proper D3 update pattern
        function updateMap(feature) {
            // Filter data for current year
            let yearFilteredData = fullData.filter(d => d["year"] === currentYear);
            const extent = d3.extent(yearFilteredData, d => d[feature]);
            const colorScale = d3.scaleSequential(d3.interpolateBlues).domain(extent);

            // Use D3 update pattern - just update fill color
            map.transition()
                .duration(500)
                .attr("fill", d => {
                    let countryCode = d.properties ? d.properties.id : null;
                    
                    // Find data for current year
                    let yearData = fullData.find(row => 
                        row["Country Code"] === countryCode && row["year"] === currentYear
                    );
                    
                    if (yearData && yearData[feature] != null) {
                        return colorScale(yearData[feature]);
                    }
                    return "#ccc";
                });
        }
        
        // Store updateMap function globally for indicator changes
        updateMapFunction = updateMap;

        updateMap(select.property("value"));

        select.on("change", function() {
            updateMap(this.value);
            // Re-render line chart if a country is selected
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
        
        // Add year slider event listener
        d3.select("#year_slider").on("input", function() {
            currentYear = parseInt(this.value);
            d3.select("#year_label").text(currentYear);
            updateMap(select.property("value"));
            
            // Re-render line chart if a country is selected
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
            
            // Re-render multi-country chart if countries are brushed
            if (brushedCountries.size > 0) {
                renderMultiLineChart(Array.from(brushedCountries));
            }
        });
    });
}

function initScatter(pcaData) {
    // Store PCA data globally for brush operations
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
        .range([height, 0]);  // flipped: SVG y grows downward

    g.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x));

    g.append("g")
        .call(d3.axisLeft(y));
    console.log(pcaData.map(d => d[0])[0])

    const tooltip = d3.select("#tooltip");
    // Dots
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
            // Only highlight if not brushed
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
            // Only reset if not brushed
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
    
    dots.each(function(d) {
        let countryCode = d["Country Code"];
        if (countryCode) {
            scatterDotsLookup[countryCode] = d3.select(this);
        }
    });
    
    // Add brush functionality
    const brush = d3.brush()
        .extent([[0, 0], [width, height]])
        .on("brush", brushed)
        .on("end", brushEnd);
    
    g.append("g")
        .attr("class", "brush")
        .call(brush);
    
    function brushed(event) {
        if (!event.selection) return;
        
        const [[x0, y0], [x1, y1]] = event.selection;
        
        // Clear previous brush selection
        brushedCountries.clear();
        
        // Reset all dots to steelblue
        dots.attr("fill", d => {
            return "steelblue";
        }).attr("r", 5);
        
        // Reset all map countries
        d3.selectAll("path").attr("fill", "white")
            .attr("stroke-width", 0.5)
            .attr("stroke", "black");
        
        // Find dots within brush selection
        dots.each(function(d) {
            const px = x(d[0]);
            const py = y(d[1]);
            
            if (px >= x0 && px <= x1 && py >= y0 && py <= y1) {
                brushedCountries.add(d["Country Code"]);
            }
        });
        
        // Highlight brushed dots
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
        
        // Highlight brushed countries on map
        brushedCountries.forEach(countryCode => {
            if (mapLookup[countryCode]) {
                mapLookup[countryCode]
                    .attr("fill", "orange")
                    .attr("stroke-width", 2)
                    .attr("stroke", "red");
            }
        });
        
        // Update line chart if countries are brushed
        if (brushedCountries.size > 0) {
            renderMultiLineChart(Array.from(brushedCountries));
        }
    }
    
    function brushEnd(event) {
        // If brush is cleared, reset everything
        if (!event.selection) {
            brushedCountries.clear();
            
            // Reset dots
            dots.attr("fill", "steelblue")
                .attr("r", 5);
            
            // Reset map
            d3.selectAll("path").attr("fill", "white")
                .attr("stroke-width", 0.5)
                .attr("stroke", "black");
            
            // Clear line chart
            d3.select("#svg_line_plot").html("");
        }
    }
}

function renderLineChart(countryName, countryCode) {
    // Filter data for selected country across all years
    let countryData = fullDataGlobal.filter(d => d["Country Code"] === countryCode);
    
    if (countryData.length === 0) {
        console.log("No data found for country: " + countryName);
        return;
    }
    
    // Sort by year
    countryData.sort((a, b) => a["year"] - b["year"]);
    
    // Get the current indicator
    let indicator = d3.select("#indicator_change").property("value");
    
    // Prepare data with year and indicator value
    let lineData = countryData.map(d => ({
        year: d["year"],
        value: d[indicator]
    })).filter(d => d.value != null && !isNaN(d.value));
    
    if (lineData.length === 0) {
        console.log("No data found for indicator: " + indicator);
        return;
    }
    
    let container = d3.select("#svg_line_plot");
    
    // Set dimensions
    const margin = { top: 40, right: 30, bottom: 40, left: 70 };
    const width = 900 - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;
    
    // Create or update SVG using D3 pattern
    let svg = container.selectAll("svg").data([null]);
    
    svg.exit().remove();
    
    svg = svg.enter()
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .merge(svg);
    
    // Update title
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
        .text(`${countryName} - ${indicator} (1960-2020)`);
    
    // Ensure main group exists
    let g = svg.selectAll(".chart-group").data([null]);
    g = g.enter()
        .append("g")
        .attr("class", "chart-group")
        .attr("transform", `translate(${margin.left},${margin.top})`)
        .merge(g);
    
    // Create scales with safe domain
    const yMin = Math.min(0, d3.min(lineData, d => d.value));
    const yMax = d3.max(lineData, d => d.value);
    
    const xScale = d3.scaleLinear()
        .domain(d3.extent(lineData, d => d.year))
        .range([0, width]);
    
    const yScale = d3.scaleLinear()
        .domain([yMin, yMax * 1.1])
        .range([height, 0]);
    
    // Create line generator
    const line = d3.line()
        .x(d => xScale(d.year))
        .y(d => yScale(d.value));
    
    // Update X axis
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
    
    // Update Y axis
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
    
    // Update line path using D3 update pattern
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
    
    // Update circles for data points using D3 update pattern
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
    // Get data for all brushed countries
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
        console.log("No data found for brushed countries");
        return;
    }
    
    let container = d3.select("#svg_line_plot");
    
    // Set dimensions
    const margin = { top: 40, right: 30, bottom: 40, left: 70 };
    const width = 900 - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;
    
    // Create or update SVG using D3 pattern
    let svg = container.selectAll("svg").data([null]);
    svg.exit().remove();
    svg = svg.enter()
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .merge(svg);
    
    // Update title
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
    
    // Ensure main group exists
    let g = svg.selectAll(".chart-group").data([null]);
    g = g.enter()
        .append("g")
        .attr("class", "chart-group")
        .attr("transform", `translate(${margin.left},${margin.top})`)
        .merge(g);
    
    // Create scales
    const yMin = Math.min(0, d3.min(allCountryData, d => d.value));
    const yMax = d3.max(allCountryData, d => d.value);
    
    const xScale = d3.scaleLinear()
        .domain(d3.extent(allCountryData, d => d.year))
        .range([0, width]);
    
    const yScale = d3.scaleLinear()
        .domain([yMin, yMax * 1.1])
        .range([height, 0]);
    
    // Create line generator
    const line = d3.line()
        .x(d => xScale(d.year))
        .y(d => yScale(d.value));
    
    // Update X axis
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
    
    // Update Y axis
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
    
    // Group data by country
    const groupedData = d3.group(allCountryData, d => d.country);
    
    // Update line paths for each country using D3 pattern
    let paths = g.selectAll(".line-path").data(Array.from(groupedData.entries()), d => d[0]);
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
    
    // Update circles for each country using D3 pattern
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
    
    // Update legend using D3 pattern
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
        .attr("fill", (d) => groupedData.get(d)[0].color);
    
    legendEnter.append("text")
        .merge(legend.select("text"))
        .attr("x", width - 24)
        .attr("y", 9.5)
        .attr("dy", "0.32em")
        .text(d => d);
}

