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

// 3. 데이터 로드 경로
const worldDataPath = 'data/world_data.csv';
const wildsDataPath = 'data/wilds_data.csv';

// 4. 데이터 로드 및 차트 그리기
Promise.all([
    d3.csv(worldDataPath),
    d3.csv(wildsDataPath)
]).then(([worldData, wildsData]) => {
    
    // 데이터 파싱 (문자 -> 숫자)
    const parseData = d => {
        d.days = +d.days;
        d.players = +d.players;
        return d;
    };
    worldData.forEach(parseData);
    wildsData.forEach(parseData);
    
    // 스케일 설정
    const maxDays = Math.max(d3.max(worldData, d => d.days), d3.max(wildsData, d => d.days));
    const maxPlayers = Math.max(d3.max(worldData, d => d.players), d3.max(wildsData, d => d.players));
    
    const xScale = d3.scaleLinear().domain([0, maxDays]).range([0, width]);
    const yScale = d3.scaleLinear().domain([0, maxPlayers]).range([height, 0]);

    // 축 생성
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale))
        .append("text")
        .attr("x", width / 2).attr("y", 40).attr("fill", "#000")
        .attr("font-weight", "bold").text("출시 후 경과일 (Days after release)");

    svg.append("g")
        .call(d3.axisLeft(yScale).ticks(5, d => (d >= 1000000 ? `${d / 1000000}M` : `${d / 1000}k`)))
        .append("text")
        .attr("transform", "rotate(-90)").attr("y", -50).attr("x", -height / 2).attr("fill", "#000")
        .attr("font-weight", "bold").attr("text-anchor", "middle").text("동시 접속자 수");

    // 영역(Area) 생성기
    const areaGenerator = d3.area()
        .x(d => xScale(d.days))
        .y0(height) 
        .y1(d => yScale(d.players))
        .curve(d3.curveMonotoneX);

    // 영역 그래프 그리기
    svg.append("path")
        .datum(wildsData)
        .attr("fill", "#d95f02")
        .attr("opacity", 0.6)
        .attr("d", areaGenerator);
        
    svg.append("path")
        .datum(worldData)
        .attr("fill", "#405d7b")
        .attr("opacity", 0.7)
        .attr("d", areaGenerator);

}).catch(error => {
    // 만약 이 코드로도 차트가 보이지 않는다면, 콘솔에 에러가 표시될 겁니다.
    console.error("기본 차트 로딩 중 오류 발생:", error);
    d3.select("#chart-container").text("오류 발생! F12를 눌러 Console을 확인해주세요.");
});
