// 1. 차트 기본 설정
const margin = { top: 40, right: 30, bottom: 50, left: 70 };
const width = 1200 - margin.left - margin.right;
const height = 600 - margin.top - margin.bottom;

// 2. SVG 요소 설정
const svg = d3.select("#area-chart")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
  .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

// 3. 툴팁 div 생성
const tooltip = d3.select("body").append("div").attr("class", "tooltip");

// 데이터 경로, 출시일, 이벤트 데이터
const worldDataPath = 'data/world_data.csv';
const wildsDataPath = 'data/wilds_data.csv';
const releaseDates = {
    world: new Date("2018-08-09"),
    wilds: new Date("2025-02-28")
};
const events = [
    { date: "2018-09-06", label: "PC 최적화 패치", game: "world" },
    { date: "2020-01-09", label: "아이스본 출시", game: "world" },
];

// 5. 데이터 로드 및 차트 그리기
Promise.all([
    d3.csv(worldDataPath),
    d3.csv(wildsDataPath)
]).then(([worldData, wildsData]) => {
    
    const parseData = d => {
        d.days = +d.days;
        d.players = +d.players;
        return d;
    };
    worldData.forEach(parseData);
    wildsData.forEach(parseData);
    
    const maxDays = Math.max(d3.max(worldData, d => d.days), d3.max(wildsData, d => d.days));
    const maxPlayers = Math.max(d3.max(worldData, d => d.players), d3.max(wildsData, d => d.players));
    
    // ✅ 변경점 1: X축, Y축 모두 가장 간단한 선형(Linear) 스케일로 변경
    const xScale = d3.scaleLinear().domain([0, maxDays]).range([0, width]);
    const yScale = d3.scaleLinear().domain([0, maxPlayers]).range([height, 0]);

    // 축 생성
    svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(xScale)).append("text").attr("x", width / 2).attr("y", 40).attr("fill", "#000").attr("font-weight", "bold").text("출시 후 경과일 (Days after release)");
    svg.append("g").call(d3.axisLeft(yScale).ticks(5, d => (d >= 1000000 ? `${d / 1000000}M` : `${d / 1000}k`))).append("text").attr("transform", "rotate(-90)").attr("y", -50).attr("x", -height / 2).attr("fill", "#000").attr("font-weight", "bold").attr("text-anchor", "middle").text("동시 접속자 수");

    // 8. 영역(Area) 생성기 (문제 없도록 단순화)
    const areaGenerator = d3.area()
        .x(d => xScale(d.days))
        .y0(height) 
        .y1(d => yScale(d.players))
        .curve(d3.curveMonotoneX);

    // ✅ 변경점 2: 그리는 순서를 변경하여 두 그래프가 모두 잘 보이도록 수정
    // 먼저 플레이어 수가 많은 Wilds를 그립니다 (뒤쪽에 배치)
    svg.append("path")
        .datum(wildsData)
        .attr("fill", "#d95f02")
        .attr("opacity", 0.6) // 투명도 조절
        .attr("d", areaGenerator);
        
    // 나중에 플레이어 수가 적은 World를 그립니다 (앞쪽에 배치)
    svg.append("path")
        .datum(worldData)
        .attr("fill", "#405d7b")
        .attr("opacity", 0.7) // 투명도 조절
        .attr("d", areaGenerator);
    
    // 이벤트 마커 로직은 그대로 유지
    // ...
    
    // 통합 툴팁 기능 (이전과 동일하게 잘 작동합니다)
    const focus = svg.append("g").style("opacity", 0);
    focus.append("line").attr("class", "focus-line").attr("y1", 0).attr("y2", height);
    const worldCircle = focus.append("circle").attr("r", 5).attr("class", "focus-circle");
    const wildsCircle = focus.append("circle").attr("r", 5).attr("class", "focus-circle");

    svg.append("rect")
        .attr("class", "listening-rect")
        .attr("width", width)
        .attr("height", height)
        .style("fill", "none")
        .style("pointer-events", "all")
        .on("mouseover", () => { focus.style("opacity", 1); tooltip.style("opacity", 1); })
        .on("mouseout", () => { focus.style("opacity", 0); tooltip.style("opacity", 0); })
        .on("mousemove", mousemove);

    const bisectDate = d3.bisector(d => d.days).left;

    function mousemove(event) {
        const x0 = xScale.invert(d3.pointer(event)[0]);
        const i_world = bisectDate(worldData, x0, 1);
        const i_wilds = bisectDate(wildsData, x0, 1);
        const d_world = worldData[i_world];
        const d_wilds = wildsData[i_wilds];
        
        if (!d_world || !d_wilds) return;

        const anchorDay = (Math.abs(d_world.days - x0) < Math.abs(d_wilds.days - x0)) ? d_world.days : d_wilds.days;

        focus.attr("transform", `translate(${xScale(anchorDay)},0)`);
        worldCircle.attr("cy", yScale(d_world.players));
        wildsCircle.attr("cy", yScale(d_wilds.players));

        tooltip.html(
            `<strong>Day ${anchorDay}</strong><br/>
             <span style="color:#69b3a2;">World:</span> ${d_world ? d_world.players.toLocaleString() : 'N/A'}<br/>
             <span style="color:#ff8c00;">Wilds:</span> ${d_wilds ? d_wilds.players.toLocaleString() : 'N/A'}`
        )
        .style("left", (event.pageX + 15) + "px")
        .style("top", (event.pageY - 28) + "px");
    }

}).catch(error => {
    console.error("데이터 로딩/처리 중 오류 발생:", error);
});
