const margin = { top: 40, right: 30, bottom: 55, left: 80 };
const width = 1200 - margin.left - margin.right;
const height = 600 - margin.top - margin.bottom;

const svg = d3.select("#area-chart")
  .attr("width", width + margin.left + margin.right)
  .attr("height", height + margin.top + margin.bottom)
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

const tooltip = d3.select("body").append("div").attr("class", "tooltip");

const worldDataPath = "data/world_data.csv";
const wildsDataPath = "data/wilds_data.csv";

Promise.all([d3.csv(wildsDataPath), d3.csv(worldDataPath)])
  .then(([wildsData, worldData]) => {
    const parse = d => ({ days: +d.days, players: +d.players });
    wildsData = wildsData.map(parse).sort((a,b)=>a.days-b.days);
    worldData = worldData.map(parse).sort((a,b)=>a.days-b.days);

    const maxDays = Math.max(
      d3.max(wildsData, d => d.days) ?? 0,
      d3.max(worldData, d => d.days) ?? 0
    );
    const maxPlayers = Math.max(
      d3.max(wildsData, d => d.players) ?? 1,
      d3.max(worldData, d => d.players) ?? 1
    );

    const minY = 1000;
    const x = d3.scaleLinear().domain([0, maxDays]).range([0, width]);
    const y = d3.scaleLog().domain([minY, maxPlayers]).range([height, 0]).clamp(true);

    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x));
    svg.append("g")
      .call(d3.axisLeft(y).ticks(6, d => (d >= 1e6 ? d/1e6+"M" : d/1e3+"k")));

    const ySafe = v => y(Math.max(minY, v));
    const area = d3.area()
      .x(d => x(d.days))
      .y0(y(minY)) // 바닥을 축의 최소값으로
      .y1(d => ySafe(d.players))
      .curve(d3.curveMonotoneX);
    const line = d3.line()
      .x(d => x(d.days))
      .y(d => ySafe(d.players))
      .curve(d3.curveMonotoneX);

    // Wilds 먼저
    svg.append("path").datum(wildsData)
      .attr("fill", "#d95f02").attr("opacity", 0.6).attr("d", area);
    svg.append("path").datum(wildsData)
      .attr("fill","none").attr("stroke","#9a3f00").attr("stroke-width",1.5).attr("d", line);

    // World 나중
    svg.append("path").datum(worldData)
      .attr("fill", "#405d7b").attr("opacity", 0.7).attr("d", area);
    svg.append("path").datum(worldData)
      .attr("fill","none").attr("stroke","#2c3e50").attr("stroke-width",1.5).attr("d", line);
  })
  .catch(err => console.error("데이터 로딩 오류:", err));
