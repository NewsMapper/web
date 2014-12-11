var map;
var FETCH_EVENT;

function setBounds() {
  var mh = $(window).height() - 48;
  $('#map-canvas').css('height', mh + 'px'); // 48px is the height of the header
  $('#info-canvas').css('height', (mh - 48) + 'px');
}

$(window).resize(function() {
  setBounds();
});


$(document).ready(function() {
  setBounds();
  var center = getCenter();
  var options = {
      panControl: false,
      zoomControl: true,
      zoomControlOptions: {
        style: google.maps.ZoomControlStyle.SMALL
      },
      scaleControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      zoom: 8,
      maxZoom: MAX_ZOOM,
      minZoom: MIN_ZOOM,
      center: center,
      mapTypeId: google.maps.MapTypeId.ROADMAP,
      styles: [{"stylers":[{"visibility":"on"},{"saturation":-100},{"gamma":0.54}]},{"featureType":"road","elementType":"labels.icon","stylers":[{"visibility":"off"}]},{"featureType":"water","stylers":[{"color":"#4d4946"}]},{"featureType":"poi","elementType":"labels.icon","stylers":[{"visibility":"off"}]},{"featureType":"poi","elementType":"labels.text","stylers":[{"visibility":"simplified"}]},{"featureType":"road","elementType":"geometry.fill","stylers":[{"color":"#ffffff"}]},{"featureType":"road.local","elementType":"labels.text","stylers":[{"visibility":"simplified"}]},{"featureType":"water","elementType":"labels.text.fill","stylers":[{"color":"#ffffff"}]},{"featureType":"transit.line","elementType":"geometry","stylers":[{"gamma":0.48}]},{"featureType":"transit.station","elementType":"labels.icon","stylers":[{"visibility":"off"}]},{"featureType":"road","elementType":"geometry.stroke","stylers":[{"gamma":7.18}]}]
  };

  map = new google.maps.Map(document.getElementById('map-canvas'), options);
  
  function getCenter(pos) {
      return (navigator.gelocation) ? new google.maps.LatLng(pos.coords.latitude,pos.coords.longitude) : new google.maps.LatLng(40.107667,-88.22822);
  }

  function geolocate() {
      if (navigator.gelocation) navigator.geolocation.getCurrentPosition(getCenter);
  }

  google.maps.event.addDomListener(window, 'load', geolocate);
  $('#field').click(function() {
    $('#field').css('border', '1px solid #fff');
    $('#field').attr('placeholder', 'chancellor@illinois.edu');
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
        $('#field').css('border', '1px solid #333');
        $("#field").prop('disabled', true);
        $('#field').css('cursor', 'not-allowed');
  } else if (res == "?f") {
        $('#field').attr('placeholder', 'oops; please try again!');
        $('#field').css('border', '1px solid #d43f3a');
  } else if (res == "?e") {
        $('#field').attr('placeholder', 'error; tell team@news.gdyer.de!');
        $('#field').css('width', '200px');
        $('#field').css('border', '1px solid #d43f3a');
        $("#field").prop('disabled', true);
        $('#field').css('cursor', 'not-allowed');
  }


  google.maps.event.addListener(map, "dragstart", function() {
    $('#info-canvas').css('display', 'none');
    clearTimeout(FETCH_EVENT);
  });


  google.maps.event.addListener(map, "zoom_changed", function() {
    $('#info-canvas').css('display', 'none');
    clearTimeout(FETCH_EVENT);
  });





  var first = true;

  google.maps.event.addListener(map, "idle", function() {

    tweetGroup.clear();
    FETCH_EVENT = setTimeout(function() {
      fetchItems();
    }, 200);


    if (first && $(window).width() > 740) {
        $('#info-canvas').toggle('slide', { direction: 'left' }, 100);
        first = false;
    }

    if ($(window).width() < 740) {
      $('#info-canvas').css('display', 'none');
    } else {
      $('#info-canvas').css('display', 'block');
    }

  });

  var pano = map.getStreetView();
  google.maps.event.addListener(pano, 'visible_changed', function() {
    if (pano.getVisible()) $('#info-canvas').css('display', 'none');
    else $('#info-canvas').css('display', 'block');
  });
});


var app = angular.module('app', []);
app.controller('controller', function($scope) {
  $scope.saying = "democratizing headlines";
  $scope.welcomes = [[], "Hello! Hola! 您好! こんにちは！ Sawubona! And welcome to NewsMapper", "We're glad you made the trip here, wherever you are", "Drag or pan the map to anywhere in the world", "See trending news content from any location", "Hover over an article to summarize it", "Subscribe to email updates on the right", "Star, watch, or fork us on Github: /newsmapper", "Until next time, enjoy your stay"];
  $scope.desc = "Weclome to NewsMapper. We're creating news visualization tools at UIUC. Content by the people, for the people.";
  $scope.tweets = [];
  
  trendGroup = CreateTrendGroup(map);
  tweetGroup = CreateTweetGroup($scope);
  findTrendingTweetLoc(trendGroup, tweetGroup);
  findTrendingRedditLoc(trendGroup, tweetGroup);
  $scope.rects = [];
  $scope.hovered = null;
  $scope.infoWindow = null;
  $scope.slide = function slide(res) {
      $scope.$apply(function() {
	  $scope.message = $scope.welcomes[res];
      });
      console.log(res);
      $('#message').fadeIn('slow').animate({opacity: 1.0}, 3000).fadeOut('slow', function() {
	  if (res<$scope.welcomes.length)
	      return slide(++res)
      }); 
  }  


  $scope.showRegion = function(tweet) {
    var trendingLocIds = tweetGroup.getTweetTrendingLocs(tweet);
    var trendingLocs = trendingLocIds.map(trendGroup.getLoc);
    $scope.rects = trendingLocs.map(mapRegion);
    $scope.hovered = tweet.id;
    clearTimeout($scope.summaryEvent);
    $scope.summaryEvent = summarize(tweet);
  };

  $scope.clearRects = function() {
    $scope.rects.forEach(function(rect) {
        rect.setMap(null);
    });
    $scope.hovered = null;
    $scope.rects = [];
  };

  $scope.clear = function() {
    $scope.clearRects();
    clearTimeout($scope.summaryEvent);
    clearSummary(); 
    if ($scope.infoWindow !== null) {
      $scope.infoWindow.close(); 
      $scope.infoWindow = null;
    }   
  };

});
