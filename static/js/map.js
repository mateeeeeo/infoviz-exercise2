let mapWidth = 800;
let mapHeight = 500;
let map = null;
let mapData = null;


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
            .attr('fill', 'white');


        function updateMap(feature) {
        const extent = d3.extent(fullData, d => d[feature]);
        const colorScale = d3.scaleSequential(d3.interpolateBlues).domain(extent);

            map.transition().duration(500).attr("fill", d => {
                let countryCode = d.properties ? d.properties.id : null;
                let cData = dataLookup[countryCode];
                
                if (cData && cData[feature] != null) {
                    return colorScale(cData[feature]);
                }
                return "#ccc";
            });
        }

        updateMap(select.property("value"));

        select.on("change", function() {
            updateMap(this.value);
        });
    });
}

function initScatter(pcaData) {
    const margin = { top: 20, right: 20, bottom: 40, left: 40 };
    const svg = d3.select("#svg_plot");
    const width = +svg.attr("width") - margin.left - margin.right;
    const height = +svg.attr("height") - margin.top - margin.bottom;
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // each country has PC values
    // const PC1 = pcaData["0"]; // first principal component
    // const PC2 = pcaData["1"]; // second principal component
    // const countryNames = pcaData["Country Name"];

    // const PC1Values = Object.values(PC1);
    // const PC2Values = Object.values(PC2);
    // const countryNamesValues = Object.values(countryNames);

    // const dataset = []
    // for (let i = 0; i < PC1Values.length; i++) {
    //     dataset.push({ "Country": countryNamesValues[i], "PC1": PC1Values[i], "PC2": PC2Values[i]});
    // }
    // console.log(dataset)

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
    g.selectAll("circle")
        .data(pcaData)
        .enter()
        .append("circle")
        .attr("cx", d => x(d[0]))
        .attr("cy", d => y(d[1]))
        .attr("r", 5)
        .attr("fill", "steelblue")
        .style("cursor", "pointer")
        .on("mouseover", function (event, d) {
            d3.select(this)
                .attr("r", 8)
                .attr("fill", "red");
            tooltip.html("Country Name: " + d["Country Name"]);
            tooltip.style("opacity", 1);
        })
        .on("mousemove", function (event) {
            tooltip
                .style("left", (event.pageX + 8) + "px")
                .style("top", (event.pageY + 8) + "px");
        })
        .on("mouseout", function () {
            d3.select(this)
                .attr("r", 5)
                .attr("fill", "steelblue");
            tooltip.style("opacity", 0);
        })
}

