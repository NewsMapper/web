function setBounds() {
  var mh = $(window).height() - 48;
  $('#map-canvas').css('height', mh + 'px'); // 48px is the height of the header
  $('#info-canvas').css('height', (mh - 48) + 'px');
}



var app = angular.module('app', []);
app.controller('controller', function($scope) {
  var trendGroup = CreateTrendGroup();
  var tweetGroup = CreateTweetGroup($scope);
  findTrendingLoc(trendGroup, tweetGroup);
});





$(window).resize(function() {
  setBounds();
});



$(document).ready(function() {
  setBounds();

  var center;
  if ($(window).width() > 400) center = new google.maps.LatLng(40.105876,-88.228111);
  else center = new google.maps.LatLng(40.107667,-88.228224);
  var options = {
      panControl: false,
      zoomControl: true,
      zoomControlOptions: {
        style: google.maps.ZoomControlStyle.SMALL
      },
      scaleControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      zoom: 16,
      maxZoom: 20,
      minZoom: 4,
      center: center,
      mapTypeId: google.maps.MapTypeId.HYBRID,
      styles: [{"featureType":"road","elementType":"geometry","stylers":[{"visibility":"off"}]},{"featureType":"poi","elementType":"geometry","stylers":[{"visibility":"off"}]},{"featureType":"landscape","elementType":"geometry","stylers":[{"color":"#fffffa"}]},{"featureType":"water","stylers":[{"lightness":50}]},{"featureType":"road","elementType":"labels","stylers":[{"visibility":"off"}]},{"featureType":"transit","stylers":[{"visibility":"off"}]},{"featureType":"administrative","elementType":"geometry","stylers":[{"lightness":40}]}]
  };

  var map = new google.maps.Map(document.getElementById('map-canvas'), options);
  function createMarker(point) {
      var latlng = new google.maps.LatLng(point["lat"],point["lon"]);
      var content;
      if ($(window).width() > 600) content = '<div class="scrollFix">' + point["title"] + '</div>';
      else content = point["title"];
      var infowindow = new google.maps.InfoWindow({
        content: content
      });

      var marker = new google.maps.Marker({
          position: latlng,
          map: map
      });

      google.maps.event.addListener(marker, 'click', function() {
              infowindow.open(map, this);
        });

      // if ($(window).width() > 500) {
      //   google.maps.event.addListener(marker, 'mouseout', function() {
      //         infowindow.close();
      //   });
      // }

  }

  function initialize() {
    var stDate;
    var now;
    var assoc = new Array(7);
    assoc[0] = "Sunday";
    assoc[1] = "Monday";
    assoc[2] = "Tuesday";
    assoc[3] = "Wednesday";
    assoc[4] = "Thursday";
    assoc[5] = "Friday";
    assoc[6] = "Saturday";
    now = new Date();
    stDate = now.getDay();
    DayOfWeek = (assoc[stDate]);

    var points = [
      {
        "lat" : 40.114066,
        "lon" : -88.224699,
        "title" : "But if you tell us your email address above, we'll keep you posted."
      },{
        "lat" : 40.112409,
        "lon" : -88.226836,
        "title" : "We're not ready for public consumption yet."
      },{
        "lat" : 40.109307,
        "lon" : -88.228347,
        "title" : "Hello, welcome to NewsMapper."
      },{
        "lat" : 40.110858,
        "lon" : -88.226976,
        "title" : "We're part of CS 196 at UIUC (if you couldn't recognize the area)"
      },{
        "lat" : 40.115699,
        "lon" : -88.227291,
        "title" : "In the meantime, enjoy the rest of your " + DayOfWeek + "!"
      }
    ];

    for (i=0;i<points.length;i++) {
      createMarker(points[i]);
    }
  }
  google.maps.event.addDomListener(window, 'load', initialize);
  
  $('#field').click(function() {
    $('#field').css('border', 'none');
    $('#field').attr('placeholder', 'email@host.com');
  });

  $('body').click(function(e) {
    var res = window.location.search;
    if (!$(e.target).is('#field') && res != "?s" && res != '?e') {
        $('#field').attr('placeholder', 'subscribe to updates');
    }
  });

  var res = window.location.search;
  if (res == "?s") {
        $('#field').attr('placeholder', 'we got it; thank you!');
        $('#field').css('background-color', '#003C7D');
        $('#field').css('border', '1px solid #fff');
        $("#field").prop('disabled', true);
        $('#field').css('cursor', 'not-allowed');
  } else if (res == "?f") {
        $('#field').attr('placeholder', 'oops; please try again!');
        $('#field').css('background-color', '#003C7D');
        $('#field').css('border', '1px solid #F47F24');
  } else if (res == "?e") {
        $('#field').attr('placeholder', 'error; tell team@news.gdyer.de!');
        $('#field').css('background-color', '#003C7D');
        $('#field').css('width', '200px');
        $('#field').css('border', '1px solid #F47F24');
        $("#field").prop('disabled', true);
        $('#field').css('cursor', 'not-allowed');
  }

  var first = true;
  google.maps.event.addListener(map, "idle", function() {
    if (first) {
      console.log('fo');
      if ($(window).width()>740) {
        $('#info-canvas').toggle('slide', { direction: 'left' }, 100);
        first = false;
      }
    }
    if ($(window).width()<740) $('#info-canvas').css('display', 'none');
    else $('#info-canvas').css('display', 'block');
  });
  var pano = map.getStreetView();
  google.maps.event.addListener(pano, 'visible_changed', function() {
    if (pano.getVisible()) $('#info-canvas').css('display', 'none');
    else $('#info-canvas').css('display', 'block');
  });
});

