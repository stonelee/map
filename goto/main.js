$(function() {
  var map = new AMap.Map('map');

  //tian an men
  var targetPos = '116.397507,39.908699';
  var targetLngLat,
    targetName,
    homeLngLat,
    homeName;

  var getIcon = (function() {
    var options = {
      start: [32, 0],
      end: [32, -32],
      bus: [28, -64],
      subway: [28, -92],
      walk: [28, -120]
    };

    return function(name) {
      var option = options[name];
      var width = option[0],
        offsetWidth = option[1];
      return new AMap.Icon({
        image: 'images/busmapicon.png',
        size: new AMap.Size(width, 32),
        imageOffset: new AMap.Pixel(offsetWidth, 0)
      });
    };
  }());

  function parseLngLat(lng, lat) {
    if (!lat) {
      var pos = lng.split(',');
      lng = pos[0];
      lat = pos[1];
    }
    return new AMap.LngLat(lng, lat);
  }

  function getHomeMarker() {
    var defer = $.Deferred();
    if (navigator.geolocation) {
      var gps = navigator.geolocation;
      gps.getCurrentPosition(function(pos) {
        addHomeMarker(parseLngLat(pos.coords.longitude, pos.coords.latitude));
        $('<span>').html('已获取').css('background', 'yellow').insertAfter('#btnPosition');
        defer.resolve();
      });
    }
    return defer.promise();
  }

  function addHomeMarker(pos) {
    var marker = new AMap.Marker({
      map: map,
      position: pos,
      icon: getIcon('start'),
      draggable: true
    });

    homeLngLat = pos;
    getName(homeLngLat).then(function(name) {
      homeName = name;
    });

    AMap.event.addListener(marker, 'dragend', function(e) {

      console.log(e);
      homeLngLat = e.lnglat;

      getName(homeLngLat).then(function(name) {
        homeName = name;
      });
    });
  }

  function getName(lngLat) {
    var defer = $.Deferred();
    var geo = new AMap.Geocoder();
    geo.regeocode(lngLat, function(data) {
      var name = data.list[0].poilist[0].name;
      defer.resolve(name);
    });
    return defer.promise();
  }

  function addTargetMarker() {
    targetLngLat = parseLngLat(targetPos);
    getName(targetLngLat).then(function(name) {
      targetName = name;
    });

    new AMap.Marker({
      map: map,
      position: targetLngLat,
      icon: getIcon('end')
    });
  }

  getHomeMarker();
  addTargetMarker();

  $('#btnPosition').click(function(e) {
    var listener = AMap.event.addListener(map, 'click', function(e) {
      addHomeMarker(e.lnglat);
      AMap.event.removeListener(listener);
    });
  });

  function parsePath(path) {
    return $.map(path.split(';'), function(p, i) {
      return parseLngLat(p);
    });
  }

  function drawPath(path) {
    new AMap.Polyline({
      map: map,
      path: path,
      strokeColor: '#F00',
      strokeOpacity: 0.6,
      strokeWeight: 5,
    });
  }

  function drawPoint(point) {
    new AMap.Circle({
      map: map,
      center: point,
      radius: 50,
      strokeColor: '#F33',
      strokeOpacity: 1,
      strokeWeight: 1,
      fillColor: '#e20',
      fillOpacity: 0.4
    });
  }

  var template = Handlebars.compile($('#result-template').html());

  function getBusName(name) {
    var index = name.indexOf('(');
    if (index >= 0) {
      return name.substr(0, index);
    } else {
      return name;
    }
  }

  $('#btnSearch').click(function(e) {
    map.clearMap();

    addTargetMarker();
    addHomeMarker(homeLngLat);

    var bus = new AMap.BusSearch();
    bus.byTwoPoi([homeLngLat, targetLngLat], '010', function(data) {
      if (data.status !== 'E0') {
        console.error(data.status);
        return;
      }
      showBusResults(data.list);
    });
  });

  Handlebars.registerHelper('paths', function() {
    console.log(this);
    var result = '';
    $.each(this.segmentList, function(i, p) {
      result += '<li><b class="icon-walk"></b>步行 到 ' + p.startName + ' <small>' + p.footLength + '米</small></li>';
      result += '<li><b class="icon-subway"></b>乘 ' + p.busName + ' 到 ' + p.endName + '<small>' + p.passDepotCount + '站</small></li>';
    });
    result += '<li><b class="icon-walk"></b>步行 到 终点<small>' + this.footEndLength + '米</small></li>';
    return result;
  });

  function showBusResults(data) {
    //$.each(data, function(index, d) {
    //});

    var results = [];
    var index = 0;
    var d = data[index];

    console.log(d);

    var bounds = d.bounds.split(';');
    var sw = new AMap.LngLat(bounds[0], bounds[1]),
      ne = new AMap.LngLat(bounds[2], bounds[3]);
    map.setBounds(new AMap.Bounds(sw, ne));

    var busNames = [],
      driverLengths = 0,
      footLengths = 0;
    $.each(d.segmentList, function(j, segment) {
      busNames.push(getBusName(segment.busName));
      driverLengths += parseInt(segment.driverLength, 10);
      footLengths += parseInt(segment.footLength, 10);

      drawPath(parsePath(segment.coordinateList));

      if (parseInt(segment.passDepotCount, 10)) {
        var points = parsePath(segment.passDepotCoordinate);
        $.each(points, function(k, point) {
          drawPoint(point);
        });
      }
    });

    driverLengths = (driverLengths / 1000).toFixed(2);
    footLengths = (footLengths / 1000).toFixed(2);
    var transferNumber = d.segmentList.length - 1;

    results.push({
      segmentList: d.segmentList,
      footEndLength: d.footEndLength,
      index: index + 1,
      busNames: busNames.join(' - '),
      driverLengths: driverLengths,
      footLengths: footLengths,
      transferNumber: transferNumber,
      startName: homeName,
      endName: targetName
    });
    var html = template({
      results: results
    });
    $('#result').html(html);
  }

  $('dt', '#result').click(function() {
    $(this).parent().addClass('open').siblings().removeClass('open');
  });

});
