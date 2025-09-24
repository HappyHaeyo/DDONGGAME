// 1. 차트 기본 설정
const margin = { top: 40, right: 30, bottom: 50, left: 70 };
// 변경점 1: 차트 크기를 키웠습니다. (원하는 크기로 조절하세요)
const width = 1200 - margin.left - margin.right;
const height = 600 - margin.top - margin.bottom;

// 2. SVG 요소 설정
const svg = d3.select("#area-chart")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
  .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

// ... (툴팁, 데이터 경로, 출시일, 이벤트 데이터는 이전과 동일) ...
const tooltip = d3.select("body").append("div").attr("class", "tooltip");
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
    
    // 6. X, Y축 스케일 설정
    const maxDays = Math.max(d3.max(worldData, d => d.days), d3.max(wildsData, d => d.days));
    const maxPlayers = Math.max(d3.max(worldData, d => d.players), d3.max(wildsData, d => d.players));

    const xScale = d3.scaleLinear()
        .domain([0, maxDays])
        .range([0, width]);

    // 변경점 2: Y축을 로그 스케일로 변경했습니다.
    const yScale = d3.scaleLog()
        // 로그 스케일의 domain은 0이 될 수 없으므로 작은 값(예: 10000)으로 시작
        .domain([10000, maxPlayers]) 
        .range([height, 0]);

    // 7. 축 생성
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale))
        .append("text")
        .attr("x", width / 2)
        .attr("y", 40)
        .attr("fill", "#000")
        .attr("font-weight", "bold")
        .text("출시 후 경과일 (Days after release)");

    // 로그 스케일에 맞는 축 눈금 형식을 지정합니다.
    svg.append("g")
        .call(d3.axisLeft(yScale).ticks(5, d => {
            if (d >= 1000000) return `${d / 1000000}M`;
            if (d >= 1000) return `${d / 1000}k`;
            return d;
        }))
        .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -50)
        .attr("x", -height / 2)
        .attr("fill", "#000")
        .attr("font-weight", "bold")
        .attr("text-anchor", "middle")
        .text("동시 접속자 수 (로그 스케일)");

    // 8. 영역(Area) 생성기
    const areaGenerator = d3.area()
        .x(d => xScale(d.days))
        // 변경점 3: y0 시작점을 로그 스케일의 최솟값으로 설정합니다.
        .y0(yScale(10000)) 
        .y1(d => yScale(d.players))
        .curve(d3.curveMonotoneX);

    // ... (이후 영역 그리기, 이벤트 마커 로직은 이전과 동일) ...
    svg.append("path")
        .datum(worldData)
        .attr("fill", "#405d7b")
        .attr("opacity", 0.7)
        .attr("d", areaGenerator);
    
    svg.append("path")
        .datum(wildsData)
        .attr("fill", "#d95f02")
        .attr("opacity", 0.7)
        .attr("d", areaGenerator);

    const parseEventDate = d3.timeParse("%Y-%m-%d");
    const oneDay = 1000 * 60 * 60 * 24;

    events.forEach(event => {
        const eventDate = parseEventDate(event.date);
        const gameReleaseDate = releaseDates[event.game];
        event.day = Math.round((eventDate - gameReleaseDate) / oneDay);
    });

    const eventMarkers = svg.append("g");

    eventMarkers.selectAll(".event-line")
        .data(events)
        .enter()
        .append("line")
        .attr("class", "event-line")
        .attr("x1", d => xScale(d.day))
        .attr("x2", d => xScale(d.day))
        .attr("y1", margin.top - 20)
        .attr("y2", height);

    eventMarkers.selectAll(".event-label")
        .data(events)
        .enter()
        .append("text")
        .attr("class", "event-label")
        .attr("x", d => xScale(d.day))
        .attr("y", margin.top - 25)
        .text(d => d.label);

}).catch(error => {
    console.error("데이터 로딩/처리 중 오류 발생:", error);
    d3.select("#chart-container").text("데이터를 불러오는 데 실패했습니다. CSV 파일 형식을 확인해주세요.");
});
