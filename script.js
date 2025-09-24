'use strict';

// chart size
var margin = { top: 40, right: 30, bottom: 55, left: 80 };
var width  = 1200 - margin.left - margin.right;
var height = 600  - margin.top  - margin.bottom;

// svg
var svg = d3.select('#area-chart')
  .attr('width',  width  + margin.left + margin.right)
  .attr('height', height + margin.top  + margin.bottom)
  .append('g')
  .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

// tooltip
var tooltip = d3.select('body').append('div').attr('class', 'tooltip');

// data paths
var wildsPath = 'data/wilds_data.csv';
var worldPath = 'data/world_data.csv';

// load both CSVs
Promise.all([ d3.csv(wildsPath), d3.csv(worldPath) ]).then(function(res){
  // parse & sort
  var wilds = res[0].map(function(d){ return { days:+d.days, players:+d.players }; })
                   .filter(function(d){ return isFinite(d.days) && isFinite(d.players); })
                   .sort(function(a,b){ return a.days - b.days; });
  var world = res[1].map(function(d){ return { days:+d.days, players:+d.players }; })
                   .filter(function(d){ return isFinite(d.days) && isFinite(d.players); })
                   .sort(function(a,b){ return a.days - b.days; });

  // domains
  var maxDays = Math.max(
    d3.max(wilds, function(d){ return d.days; }) || 0,
    d3.max(world, function(d){ return d.days; }) || 0
  );
  var maxPlayers = Math.max(
    d3.max(wilds, function(d){ return d.players; }) || 1,
    d3.max(world, function(d){ return d.players; }) || 1
  );

  // log-scale minimum
  var minY = 1000;

  var x = d3.scaleLinear().domain([0, maxDays]).range([0, width]);
  var y = d3.scaleLog().domain([minY, maxPlayers]).range([height, 0]).clamp(true);

  // axes
  svg.append('g')
    .attr('transform', 'translate(0,' + height + ')')
    .call(d3.axisBottom(x));
  svg.append('g')
    .call(d3.axisLeft(y).ticks(6, function(d){
      return d >= 1000000 ? (d/1000000) + 'M' : (d/1000) + 'k';
    }));

  // helpers
  function ySafe(v){ return y(Math.max(minY, v)); }

  var area = d3.area()
    .x(function(d){ return x(d.days); })
    .y0(y(minY)) // bottom aligned to log-scale floor
    .y1(function(d){ return ySafe(d.players); })
    .curve(d3.curveMonotoneX);

  var line = d3.line()
    .x(function(d){ return x(d.days); })
    .y(function(d){ return ySafe(d.players); })
    .curve(d3.curveMonotoneX);

  // draw: Wilds first, World later (World on top)
  svg.append('path').datum(wilds)
    .attr('fill', '#d95f02').attr('opacity', 0.65).attr('d', area);
  svg.append('path').datum(wilds)
    .attr('fill', 'none').attr('stroke', '#9a3f00').attr('stroke-width', 1.5).attr('d', line);

  svg.append('path').datum(world)
    .attr('fill', '#405d7b').attr('opacity', 0.7).attr('d', area);
  svg.append('path').datum(world)
    .attr('fill', 'none').attr('stroke', '#2c3e50').attr('stroke-width', 1.6).attr('d', line);

  // focus & tooltip
  var focus = svg.append('g').style('opacity', 0);
  focus.append('line').attr('class','focus-line').attr('y1',0).attr('y2',height);
  var dotW = focus.append('circle').attr('r',4).attr('class','focus-circle');
  var dotZ = focus.append('circle').attr('r',4).attr('class','focus-circle');

  var bisect = d3.bisector(function(d){ return d.days; }).left;

  svg.append('rect')
    .attr('width', width).attr('height', height)
    .style('fill','none').style('pointer-events','all')
    .on('mouseover', function(){ focus.style('opacity',1); tooltip.style('opacity',1); })
    .on('mouseout',  function(){ focus.style('opacity',0); tooltip.style('opacity',0); })
    .on('mousemove', function(event){
      var mouseX = d3.pointer(event)[0];
      var dayX = x.invert(mouseX);

      function pick(arr){
        if (!arr.length) return null;
        var i = Math.max(1, Math.min(arr.length - 1, bisect(arr, dayX)));
        var a0 = arr[i-1], a1 = arr[i];
        if (!a0 || !a1) return a0 || a1;
        return (dayX - a0.days) < (a1.days - dayX) ? a0 : a1;
      }

      var pw = pick(world);
      var pz = pick(wilds);
      if (!pw && !pz) return;

      var anchor = pw && pz ? (Math.abs(pw.days - dayX) <= Math.abs(pz.days - dayX) ? pw.days : pz.days)
                            : (pw ? pw.days : pz.days);

      focus.attr('transform', 'translate(' + x(anchor) + ',0)');
      if (pw) { dotW.style('opacity',1).attr('cy', ySafe(pw.players)); } else { dotW.style('opacity',0); }
      if (pz) { dotZ.style('opacity',1).attr('cy', ySafe(pz.players)); } else { dotZ.style('opacity',0); }

      var html = '<strong>Day ' + anchor + '</strong><br/>' +
                 '<span style="color:#405d7b">World:</span> ' + (pw ? pw.players.toLocaleString() : 'N/A') + '<br/>' +
                 '<span style="color:#d95f02">Wilds:</span> ' + (pz ? pz.players.toLocaleString() : 'N/A');
      tooltip.html(html)
        .style('left', (event.pageX + 14) + 'px')
        .style('top',  (event.pageY - 28) + 'px');
    });

}).catch(function(err){
  console.error('load error:', err);
});
