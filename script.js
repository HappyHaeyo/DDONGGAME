'use strict';

/* ===== 기본 설정 ===== */
var margin = { top: 40, right: 30, bottom: 55, left: 80 };
var width  = 1200 - margin.left - margin.right;
var height = 600  - margin.top  - margin.bottom;

var svg = d3.select('#area-chart')
  .attr('width',  width  + margin.left + margin.right)
  .attr('height', height + margin.top  + margin.bottom)
  .append('g')
  .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

var tooltip = d3.select('body').append('div').attr('class', 'tooltip');

var COLOR = {
  wildsFill:  getComputedStyle(document.documentElement).getPropertyValue('--wilds-fill').trim() || '#E69F00',
  wildsLine:  getComputedStyle(document.documentElement).getPropertyValue('--wilds-stroke').trim() || '#955E00',
  worldFill:  getComputedStyle(document.documentElement).getPropertyValue('--world-fill').trim() || '#56B4E9',
  worldLine:  getComputedStyle(document.documentElement).getPropertyValue('--world-stroke').trim() || '#2F6E8E',
  event:      getComputedStyle(document.documentElement).getPropertyValue('--event').trim() || '#D55E00'
};

/* 데이터 경로 (404가 뜨면 이 경로를 확인하세요) */
var wildsPath = 'data/wilds_data.csv';
var worldPath = 'data/world_data.csv';

/* 출시일 & 이벤트 */
var releaseDates = { world: new Date('2018-08-09'), wilds: new Date('2025-02-28') };
var events = [
  { date: '2018-09-06', label: 'PC 최적화 패치', game: 'world' },
  { date: '2020-01-09', label: '아이스본 출시',   game: 'world' }
];

/* 스케일/모드 */
var minY = 1000;
var x0 = d3.scaleLinear().range([0, width]); // 원본 x
var x  = x0.copy();                           // 현재 x(줌 반영)
var y;                                        // 현재 y(모드별)
var scaleMode = 'log';                        // 'log' | 'relative'

/* 레이어 */
var defs = svg.append('defs');
defs.append('clipPath').attr('id', 'clip')
  .append('rect').attr('width', width).attr('height', height);
var areaLayer  = svg.append('g').attr('clip-path','url(#clip)');
var lineLayer  = svg.append('g').attr('clip-path','url(#clip)');
var eventLayer = svg.append('g');
var uiLayer    = svg.append('g');

/* 축 */
var xAxisG = svg.append('g').attr('transform', 'translate(0,' + height + ')');
var yAxisG = svg.append('g');
xAxisG.append('text').attr('x', width/2).attr('y', 45).attr('fill','#000').attr('font-weight','bold')
  .attr('text-anchor','middle').text('출시 후 경과일 (Days after release)');
yAxisG.append('text').attr('transform','rotate(-90)').attr('x', -height/2).attr('y', -60)
  .attr('fill','#000').attr('font-weight','bold').attr('text-anchor','middle')
  .text('동시 접속자 수 / %');

/* 포커스 */
var focus = uiLayer.append('g').style('opacity', 0);
focus.append('line').attr('class','focus-line').attr('y1',0).attr('y2',height);
var dotWorld = focus.append('circle').attr('r',4).attr('class','focus-circle');
var dotWilds = focus.append('circle').attr('r',4).attr('class','focus-circle');
var diffLine = focus.append('line').attr('class','focus-diff');
var overlay = uiLayer.append('rect').attr('width', width).attr('height', height)
  .style('fill','none').style('pointer-events','all');

/* 값 계산 */
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
  return d3.area()
    .x(function(d){ return x(d.days); })
    .y0(function(){ return y0Base(); })
    .y1(function(d){ return y( yVal(series, d.players) ); })
    .curve(d3.curveMonotoneX);
}
function lineGenFor(series){
  return d3.line()
    .x(function(d){ return x(d.days); })
    .y(function(d){ return y( yVal(series, d.players) ); })
    .curve(d3.curveMonotoneX);
}

/* 데이터 로드 */
Promise.all([ d3.csv(wildsPath), d3.csv(worldPath) ]).then(function(res){
  var wilds = res[0].map(function(d){ return { days:+d.days, players:+d.players }; })
                   .filter(function(d){ return isFinite(d.days) && isFinite(d.players); })
                   .sort(function(a,b){ return a.days - b.days; });
  var world = res[1].map(function(d){ return { days:+d.days, players:+d.players }; })
                   .filter(function(d){ return isFinite(d.days) && isFinite(d.players); })
                   .sort(function(a,b){ return a.days - b.days; });

  var maxDays = Math.max(
    d3.max(wilds, function(d){ return d.days; }) || 0,
    d3.max(world, function(d){ return d.days; }) || 0
  );
  var maxPlayers = Math.max(
    d3.max(wilds, function(d){ return d.players; }) || 1,
    d3.max(world, function(d){ return d.players; }) || 1
  );

  maxWorld = d3.max(world, function(d){ return d.players; }) || 1;
  maxWilds = d3.max(wilds, function(d){ return d.players; }) || 1;

  x0.domain([0, maxDays]); x.domain(x0.domain()); y = makeY(maxPlayers);

  /* path */
  var wildsArea = areaLayer.append('path').datum(wilds)
    .attr('fill', COLOR.wildsFill).attr('opacity', .7);
  var wildsLine = lineLayer.append('path').datum(wilds)
    .attr('fill','none').attr('stroke', COLOR.wildsLine).attr('stroke-width', 1.4);
  var worldArea = areaLayer.append('path').datum(world)
    .attr('fill', COLOR.worldFill).attr('opacity', .75);
  var worldLine = lineLayer.append('path').datum(world)
    .attr('fill','none').attr('stroke', COLOR.worldLine).attr('stroke-width', 1.4);

  /* 이벤트 */
  var evData = events.map(function(ev){
    return { x: dayFromRelease(ev.date, ev.game), label: ev.label };
  }).filter(function(e){ return e.x >= 0 && e.x <= maxDays; })
    .sort(function(a,b){ return a.x - b.x; });
  var evG = eventLayer.selectAll('.ev').data(evData).enter().append('g').attr('class','ev');
  evG.append('line').attr('class','event-line').attr('y1',0).attr('y2',height);
  evG.append('path').attr('class','event-symbol')
     .attr('d', d3.symbol().type(d3.symbolDiamond).size(72))
     .attr('transform','translate(0,12)');
  evG.append('rect').attr('class','event-label-bg');
  evG.append('text').attr('class','event-label').attr('dy','0.35em');

  render();

  /* 스케일 전환 */
  d3.selectAll('#controls button').on('click', function(){
    d3.selectAll('#controls button').classed('active', false);
    d3.select(this).classed('active', true);
    scaleMode = this.getAttribute('data-scale');
    y = makeY(maxPlayers);
    render();
  });

  /* 툴팁/포커스 */
  var bisect = d3.bisector(function(d){ return d.days; }).left;
  overlay
    .on('mouseover', function(){ focus.style('opacity',1); tooltip.style('opacity',1); })
    .on('mouseout',  function(){ focus.style('opacity',0); tooltip.style('opacity',0); })
    .on('mousemove', function(event){
      var mouseX = d3.pointer(event)[0];
      var dayX   = x.invert(mouseX);

      function pick(arr){
        if (!arr.length) return null;
        var i = Math.max(1, Math.min(arr.length - 1, bisect(arr, dayX)));
        var a0 = arr[i-1], a1 = arr[i];
        if (!a0 || !a1) return a0 || a1;
        return (dayX - a0.days) < (a1.days - dayX) ? a0 : a1;
      }
      var pw = pick(world), pz = pick(wilds);
      if (!pw && !pz) return;

      var anchor = pw && pz ? (Math.abs(pw.days - dayX) <= Math.abs(pz.days - dayX) ? pw.days : pz.days)
                            : (pw ? pw.days : pz.days);

      var yW = pw ? y( yVal('world', pw.players) ) : null;
      var yZ = pz ? y( yVal('wilds', pz.players) ) : null;

      focus.attr('transform', 'translate(' + x(anchor) + ',0)');
      if (pw) { dotWorld.style('opacity',1).attr('cy', yW); } else { dotWorld.style('opacity',0); }
      if (pz) { dotWilds.style('opacity',1).attr('cy', yZ); } else { dotWilds.style('opacity',0); }
      if (pw && pz){ diffLine.style('opacity',1).attr('x1',0).attr('x2',0).attr('y1', yW).attr('y2', yZ); }
      else { diffLine.style('opacity',0); }

      var absW = pw ? pw.players : null, absZ = pz ? pz.players : null;
      var pctW = pw ? (100*absW/(maxWorld||1)) : null;
      var pctZ = pz ? (100*absZ/(maxWilds||1)) : null;
      var delta = (absW!=null && absZ!=null) ? (absW - absZ) : null;
      var ratio = (absW!=null && absZ>0) ? (absW/absZ).toFixed(2) + ':1' : '—';

      var html = '<strong>Day ' + anchor + '</strong><br/>' +
                 '<span style="color:'+COLOR.worldLine+'">World:</span> ' + (absW!=null?absW.toLocaleString():'N/A') + 
                 (scaleMode==='relative'?' ('+pctW.toFixed(1)+'%)':'') + '<br/>' +
                 '<span style="color:'+COLOR.wildsLine+'">Wilds:</span> ' + (absZ!=null?absZ.toLocaleString():'N/A') + 
                 (scaleMode==='relative'?' ('+pctZ.toFixed(1)+'%)':'') + '<br/>' +
                 (delta!=null? ('Δ: '+delta.toLocaleString()+' / 비율: '+ratio) : '');
      tooltip.html(html)
        .style('left', (event.pageX + 14) + 'px')
        .style('top',  (event.pageY - 28) + 'px');
    });

  /* 줌/팬 + 리셋 */
  var zoom = d3.zoom()
    .scaleExtent([1, 20])
    .translateExtent([[0,0],[width,height]])
    .extent([[0,0],[width,height]])
    .on('zoom', function(event){
      x = event.transform.rescaleX(x0);
      render();
    });
  svg.call(zoom);
  overlay.on('dblclick', function(){
    x = x0.copy();
    svg.call(zoom.transform, d3.zoomIdentity);
    render();
  });

  /* 렌더 */
  function render(){
    xAxisG.call(d3.axisBottom(x));

    // ❗ 틱 포맷: 함수는 tickFormat으로 지정 (두 번째 인자로 주면 에러 발생)
    var yAxis = (scaleMode==='relative')
      ? d3.axisLeft(y).ticks(6).tickFormat(function(d){ return d + '%'; })
      : d3.axisLeft(y).ticks(6).tickFormat(function(d){
          return d >= 1000000 ? (d/1000000)+'M' : (d/1000)+'k';
        });
    yAxisG.call(yAxis);

    areaLayer.selectAll('path').remove();
    lineLayer.selectAll('path').remove();

    areaLayer.append('path').datum(wilds).attr('fill', COLOR.wildsFill).attr('opacity', .7).attr('d', areaGenFor('wilds'));
    lineLayer.append('path').datum(wilds).attr('fill','none').attr('stroke', COLOR.wildsLine).attr('stroke-width', 1.4).attr('d', lineGenFor('wilds'));

    areaLayer.append('path').datum(world).attr('fill', COLOR.worldFill).attr('opacity', .75).attr('d', areaGenFor('world'));
    lineLayer.append('path').datum(world).attr('fill','none').attr('stroke', COLOR.worldLine).attr('stroke-width', 1.4).attr('d', lineGenFor('world'));

    // 이벤트 위치 & 라벨(겹침 방지)
    var evData = events.map(function(ev){ return { x: dayFromRelease(ev.date, ev.game), label: ev.label }; });
    var evG = eventLayer.selectAll('.ev').data(evData);
    evG.attr('transform', function(d){ return 'translate(' + x(d.x) + ',0)'; });
    evG.select('line.event-line').attr('y2', height);

    var anchors = evData.map(function(d){ return { x:x(d.x), width:0, d:d, xFinal:0 }; });
    evG.each(function(d, i){
      var g = d3.select(this);
      var pad=4, xoff=8, yoff=10;
      var t = g.select('text.event-label').attr('x', xoff).attr('y', yoff).text(d.label);
      var box = t.node().getBBox();
      g.select('rect.event-label-bg')
        .attr('x', box.x - pad).attr('y', box.y - pad)
        .attr('width', box.width + pad*2).attr('height', box.height + pad*2);
      anchors[i].width = box.width + pad*2 + xoff;
    });
    anchors.sort(function(a,b){ return a.x - b.x; });
    var lastRight = -Infinity;
    for (var i=0;i<anchors.length;i++){
      var left = anchors[i].x + 8;
      var right = left + anchors[i].width;
      if (left < lastRight + 6){ var shift = (lastRight + 6) - left; left += shift; right += shift; }
      anchors[i].xFinal = left; lastRight = right;
    }
    evG.each(function(d){
      var g = d3.select(this);
      var tx = anchors.find(function(a){ return a.d.x===d.x && a.d.label===d.label; }).xFinal;
      var t  = g.select('text.event-label').attr('x', tx);
      var box= t.node().getBBox();
      g.select('rect.event-label-bg')
        .attr('x', box.x - 4).attr('y', box.y - 4)
        .attr('width', box.width + 8).attr('height', box.height + 8);
    });
  }

  function dayFromRelease(iso, game){
    var t = (new Date(iso) - releaseDates[game]) / (1000*60*60*24);
    return Math.floor(t);
  }
}).catch(function(err){
  console.error('load error:', err);
});
