'use strict';

/* ===== 크기/레이어 ===== */
var margin = { top: 40, right: 30, bottom: 55, left: 80 };
var width  = 1200 - margin.left - margin.right;
var height = 600  - margin.top  - margin.bottom;

var root = d3.select('#area-chart')
  .attr('width',  width  + margin.left + margin.right)
  .attr('height', height + margin.top  + margin.bottom);

var svg = root.append('g').attr('transform','translate('+margin.left+','+margin.top+')');

/* ===== 색상 ===== */
var COLOR = {
  wildsFill:  getComputedStyle(document.documentElement).getPropertyValue('--wilds-fill').trim()  || '#E69F00',
  wildsLine:  getComputedStyle(document.documentElement).getPropertyValue('--wilds-stroke').trim()|| '#955E00',
  worldFill:  getComputedStyle(document.documentElement).getPropertyValue('--world-fill').trim()  || '#56B4E9',
  worldLine:  getComputedStyle(document.documentElement).getPropertyValue('--world-stroke').trim()|| '#2F6E8E'
};

/* ===== 데이터 경로 ===== */
var wildsPath = 'data/wilds_data.csv';
var worldPath = 'data/world_data.csv';

/* ===== 출시일 ===== */
var releaseDates = { world: new Date('2018-08-09'), wilds: new Date('2025-02-28') };

/* ===== 이벤트(월드=파랑, 와일즈=노랑) ===== */
var events = [
  // World (blue)
  { date: '2018-09-06', label: 'PC 최적화 패치', game: 'world' },
  { date: '2020-01-09', label: '아이스본 출시',   game: 'world' },
  { date: '2018-09-06', label: '타이틀 업데이트: 추가 몬스터 「공폭룡 이블조」', game: 'world' },
  { date: '2018-10-05', label: "타이틀 업데이트: 아스테라 축제 '풍작 특집'", game: 'world' },
  { date: '2018-10-19', label: '「록맨」 스페셜 콜라보', game: 'world' },
  { date: '2018-11-02', label: '특별조사【맘-타로트】 시작', game: 'world' },
  { date: '2018-11-16', label: '「Devil May Cry」 스페셜 콜라보', game: 'world' },
  { date: '2018-11-22', label: '타이틀 업데이트: 【나나-테스카토리】 등장!', game: 'world' },
  { date: '2018-11-30', label: '「역전왕」키린 / 아스테라 축제【반짝 특집】', game: 'world' },
  { date: '2018-12-14', label: '「역전왕 발하자크」 Steam 첫 등장', game: 'world' },
  { date: '2018-12-21', label: '파이널 판타지 베히모스 콜라보', game: 'world' },
  { date: '2019-01-18', label: '이벤트 퀘스트 「극 베히모스 토벌전」', game: 'world' },
  { date: '2019-01-26', label: '아스테라 축제 <감사의 연회>', game: 'world' },
  { date: '2019-05-16', label: "「Assassin's Creed」 콜라보", game: 'world' },
  { date: '2019-07-26', label: "기간 한정 이벤트 '아스테라 축제'", game: 'world' },
  { date: '2019-12-06', label: 'Iceborne 예약 구매 시작', game: 'world' },
  { date: '2020-01-09', label: 'MHW: Iceborne 발매', game: 'world' },
  { date: '2020-02-06', label: '대형 타이틀 업데이트 제1탄', game: 'world' },
  { date: '2020-03-28', label: '세리에나 축제 【만복 특집】', game: 'world' }
];

// Wilds (yellow)
events = events.concat([
  { date: '2025-04-04', label: '무료 타이틀 업데이트 타마미츠네',       game: 'wilds' },
  { date: '2025-04-30', label: '「역전왕 레 다우」 등장!',             game: 'wilds' },
  { date: '2025-05-28', label: 'Street Fighter 6 스페셜 콜라보',        game: 'wilds' },
  { date: '2025-06-30', label: '라기아크루스/ 셀레기오스 업데이트',      game: 'wilds' },
  { date: '2025-07-23', label: '계절 이벤트 「교류 축제【용화 의식】」', game: 'wilds' },
  { date: '2025-08-27', label: 'Fender 스페셜 콜라보',                  game: 'wilds' },
  { date: '2025-09-24', label: '파이널 판타지 콜라보 예정',             game: 'wilds' }
]);

/* ===== 스케일/상태 ===== */
var minY = 1000;
var x0 = d3.scaleLinear().range([0, width]); // 원본 x
var x  = x0.copy();
var y;                                        // y는 모드에 따라 달라짐
var scaleMode = 'log';                        // 'log' | 'relative'

/* ===== 레이어 ===== */
var underlay = svg.append('rect')  // 이벤트/툴팁/줌을 받는 바닥 레이어
  .attr('width', width).attr('height', height)
  .style('fill','none').style('pointer-events','all');

var defs = svg.append('defs');
defs.append('clipPath').attr('id','clip').append('rect').attr('width',width).attr('height',height);

var areaLayer  = svg.append('g').attr('clip-path','url(#clip)');
var lineLayer  = svg.append('g').attr('clip-path','url(#clip)');
var eventLayer = svg.append('g');
var uiLayer    = svg.append('g');

/* ===== 축 ===== */
var xAxisG = svg.append('g').attr('transform','translate(0,'+height+')');
var yAxisG = svg.append('g');
xAxisG.append('text').attr('x', width/2).attr('y',45).attr('fill','#000').attr('font-weight','bold')
  .attr('text-anchor','middle').text('출시 후 경과일 (Days after release)');
yAxisG.append('text').attr('transform','rotate(-90)').attr('x',-height/2).attr('y',-60)
  .attr('fill','#000').attr('font-weight','bold').attr('text-anchor','middle')
  .text('동시 접속자 수 / %');

/* ===== 포커스/툴팁 ===== */
var tooltip = d3.select('body').append('div').attr('class','tooltip');
var focus = uiLayer.append('g').style('opacity',0);
focus.append('line').attr('class','focus-line').attr('y1',0).attr('y2',height);
var dotWorld = focus.append('circle').attr('r',4).attr('class','focus-circle');
var dotWilds = focus.append('circle').attr('r',4).attr('class','focus-circle');
var diffLine = focus.append('line').attr('class','focus-diff');

var evHoverLine = uiLayer.append('line') // 이벤트 호버 라인
  .attr('class','event-hover-line')
  .attr('y1',0).attr('y2',height)
  .style('opacity',0);

/* ===== y값 계산 ===== */
var maxWorld = 1, maxWilds = 1;
function yVal(series, v){
  if (scaleMode === 'relative'){
    var base = series === 'world' ? maxWorld : maxWilds;
    return Math.max(0, 100 * v / (base || 1));
  } else {
    return Math.max(0, v);
  }
}
function makeY(maxPlayers){
  if (scaleMode === 'log'){
    return d3.scaleLog().domain([minY, maxPlayers]).range([height,0]).clamp(true);
  }
  return d3.scaleLinear().domain([0,100]).range([height,0]).nice();
}
function y0Base(){ return scaleMode === 'log' ? y(minY) : y(0); }
function areaGenFor(series){
  return d3.area().x(function(d){return x(d.days);})
    .y0(function(){return y0Base();})
    .y1(function(d){return y( yVal(series, d.players) );})
    .curve(d3.curveMonotoneX);
}
function lineGenFor(series){
  return d3.line().x(function(d){return x(d.days);})
    .y(function(d){return y( yVal(series, d.players) );})
    .curve(d3.curveMonotoneX);
}

/* ===== 데이터 로드 ===== */
Promise.all([ d3.csv(wildsPath), d3.csv(worldPath) ]).then(function(res){
  var wilds = res[0].map(function(d){return {days:+d.days, players:+d.players};})
                   .filter(function(d){return isFinite(d.days)&&isFinite(d.players);})
                   .sort(function(a,b){return a.days-b.days;});
  var world = res[1].map(function(d){return {days:+d.days, players:+d.players};})
                   .filter(function(d){return isFinite(d.days)&&isFinite(d.players);})
                   .sort(function(a,b){return a.days-b.days;});

  var maxDays = Math.max(
    d3.max(wilds,function(d){return d.days;})||0,
    d3.max(world,function(d){return d.days;})||0
  );
  var maxPlayers = Math.max(
    d3.max(wilds,function(d){return d.players;})||1,
    d3.max(world,function(d){return d.players;})||1
  );
  maxWorld = d3.max(world,function(d){return d.players;})||1;
  maxWilds = d3.max(wilds,function(d){return d.players;})||1;

  x0.domain([0,maxDays]); x.domain(x0.domain()); y = makeY(maxPlayers);

  /* 영역/선 */
  var wildsArea = areaLayer.append('path').datum(wilds)
    .attr('fill',COLOR.wildsFill).attr('opacity',.7);
  var wildsLine = lineLayer.append('path').datum(wilds)
    .attr('fill','none').attr('stroke',COLOR.wildsLine).attr('stroke-width',1.4);
  var worldArea = areaLayer.append('path').datum(world)
    .attr('fill',COLOR.worldFill).attr('opacity',.75);
  var worldLine = lineLayer.append('path').datum(world)
    .attr('fill','none').attr('stroke',COLOR.worldLine).attr('stroke-width',1.4);

  /* ===== 이벤트 원본 → 픽셀 최소간격 필터 ===== */
  var evRaw = events.map(function(ev){
    return { x: dayFromRelease(ev.date, ev.game), date: ev.date, label: ev.label, game: ev.game };
  }).filter(function(e){ return e.x>=0 && e.x<=maxDays; })
    .sort(function(a,b){ return a.x-b.x; });

  var MIN_GAP = 28; // px
  function filterEventsByGap(){
    var keep = [], lastX = -Infinity;
    evRaw.forEach(function(e){
      var px = x(e.x);
      if (px - lastX >= MIN_GAP){ keep.push(e); lastX = px; }
    });
    return keep;
  }

  var starSize = 90;
  var starsSel = eventLayer.selectAll('.ev');

  /* ===== 렌더 ===== */
  render();

  /* ===== 컨트롤(스케일 전환) ===== */
  d3.selectAll('#controls button').on('click', function(){
    d3.selectAll('#controls button').classed('active', false);
    d3.select(this).classed('active', true);
    scaleMode = this.getAttribute('data-scale');
    y = makeY(maxPlayers);
    render();
  });

  /* ===== 언더레이에서 크로스헤어/툴팁 ===== */
  var bisect = d3.bisector(function(d){ return d.days; }).left;
  underlay
    .on('mouseover', function(){ focus.style('opacity',1); tooltip.style('opacity',1); })
    .on('mouseout',  function(){ focus.style('opacity',0); tooltip.style('opacity',0); })
    .on('mousemove', function(event){
      var mouseX = d3.pointer(event, svg.node())[0];
      var dayX   = x.invert(mouseX);
      function pick(arr){
        if (!arr.length) return null;
        var i = Math.max(1, Math.min(arr.length-1, bisect(arr, dayX)));
        var a0=arr[i-1], a1=arr[i];
        return (!a0||!a1)?(a0||a1):((dayX-a0.days)<(a1.days-dayX)?a0:a1);
      }
      var pw=pick(world), pz=pick(wilds); if(!pw&&!pz) return;
      var anchor = pw&&pz ? (Math.abs(pw.days-dayX)<=Math.abs(pz.days-dayX)?pw.days:pz.days)
                          : (pw?pw.days:pz.days);
      var yW = pw ? y( yVal('world', pw.players) ) : null;
      var yZ = pz ? y( yVal('wilds', pz.players) ) : null;

      focus.attr('transform','translate('+x(anchor)+',0)');
      if(pw){ dotWorld.style('opacity',1).attr('cy',yW);} else {dotWorld.style('opacity',0);}
      if(pz){ dotWilds.style('opacity',1).attr('cy',yZ);} else {dotWilds.style('opacity',0);}
      if(pw&&pz){ diffLine.style('opacity',1).attr('x1',0).attr('x2',0).attr('y1',yW).attr('y2',yZ); }
      else{ diffLine.style('opacity',0); }

      var absW=pw?pw.players:null, absZ=pz?pz.players:null;
      var pctW=pw?(100*absW/(maxWorld||1)):null;
      var pctZ=pz?(100*absZ/(maxWilds||1)):null;
      var delta=(absW!=null&&absZ!=null)?(absW-absZ):null;
      var ratio=(absW!=null&&absZ>0)?(absW/absZ).toFixed(2)+':1':'—';

      var html='<strong>Day '+anchor+'</strong><br/>'+
               '<span style="color:'+COLOR.worldLine+'">World:</span> '+(absW!=null?absW.toLocaleString():'N/A')+
               (scaleMode==='relative'?' ('+pctW.toFixed(1)+'%)':'')+'<br/>'+
               '<span style="color:'+COLOR.wildsLine+'">Wilds:</span> '+(absZ!=null?absZ.toLocaleString():'N/A')+
               (scaleMode==='relative'?' ('+pctZ.toFixed(1)+'%)':'')+'<br/>'+
               (delta!=null?('Δ: '+delta.toLocaleString()+' / 비율: '+ratio):'');
      tooltip.html(html)
        .style('left',(event.pageX+14)+'px')
        .style('top', (event.pageY-28)+'px');
    })
    .on('click', function(){ // 배경 클릭 → 이벤트 핀 해제
      pinned = null;
      evHoverLine.style('opacity',0);
      tooltip.style('opacity',0);
    });

  /* ===== 줌/팬 ===== */
  var zoom = d3.zoom()
    .scaleExtent([1,20])
    .translateExtent([[0,0],[width,height]])
    .extent([[0,0],[width,height]])
    .on('zoom', function(event){ x = event.transform.rescaleX(x0); render(); });
  root.call(zoom);

  /* ===== 이벤트 핀 상태 ===== */
  var pinned = null;

  function render(){
    // 축
    xAxisG.call(d3.axisBottom(x));
    var yAxis = (scaleMode==='relative')
      ? d3.axisLeft(y).ticks(6).tickFormat(function(d){return d+'%';})
      : d3.axisLeft(y).ticks(6).tickFormat(function(d){return d>=1000000?(d/1000000)+'M':(d/1000)+'k';});
    yAxisG.call(yAxis);

    // 영역/선
    wildsArea.attr('d', areaGenFor('wilds'));  wildsLine.attr('d', lineGenFor('wilds'));
    worldArea.attr('d', areaGenFor('world'));  worldLine.attr('d', lineGenFor('world'));

    // 별: 최소 간격 필터 적용하여 표시(줌 시 갱신)
    var evFiltered = filterEventsByGap();
    starsSel = eventLayer.selectAll('.ev').data(evFiltered, function(d){ return d.date+'|'+d.label; });

    var starsEnter = starsSel.enter().append('g').attr('class','ev');
    starsEnter.append('path')
      .attr('class','event-star')
      .attr('d', d3.symbol().type(d3.symbolStar).size(starSize))
      .attr('fill', function(d){ return d.game==='world'?COLOR.worldFill:COLOR.wildsFill; })
      .attr('stroke','#fff').attr('stroke-width',1.2)
      .on('mouseover', function(event, d){ showEvent(d, event.pageX, event.pageY); })
      .on('mousemove', function(event, d){ showEvent(d, event.pageX, event.pageY); })
      .on('mouseout', function(){ if(!pinned){ evHoverLine.style('opacity',0); tooltip.style('opacity',0); } })
      .on('click', function(event, d){
        pinned = d;
        showEvent(d, event.pageX, event.pageY);
        event.stopPropagation();
      });

    starsSel.merge(starsEnter)
      .attr('transform', function(d){ return 'translate('+x(d.x)+',12)'; });

    starsSel.exit().remove();

    // 핀 상태면 라인 유지
    if(pinned){
      evHoverLine
        .attr('x1', x(pinned.x)).attr('x2', x(pinned.x))
        .attr('y1', 0).attr('y2', height)
        .attr('stroke', pinned.game==='world'?COLOR.worldLine:COLOR.wildsLine)
        .style('opacity',1);
    }
  }

  function showEvent(d, pageX, pageY){
    var color = d.game==='world'?COLOR.worldLine:COLOR.wildsLine;
    var name  = d.game==='world'?'World':'Wilds';
    evHoverLine
      .attr('x1', x(d.x)).attr('x2', x(d.x))
      .attr('y1', 0).attr('y2', height)
      .attr('stroke', color)
      .style('opacity', 1);
    var html = '<strong>'+d.date+'</strong><br/>' +
               '<span style="color:'+color+'">'+name+'</span> · '+d.label;
    tooltip.html(html)
      .style('left', (pageX + 12) + 'px')
      .style('top',  (pageY - 24) + 'px')
      .style('opacity', 1);
  }

  function dayFromRelease(iso, game){
    return Math.floor((new Date(iso) - releaseDates[game])/(1000*60*60*24));
  }
}).catch(function(err){ console.error('load error:', err); });
