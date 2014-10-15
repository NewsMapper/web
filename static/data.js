var TWITTER_AVAILABLE_TRENDS = '/twitter_api/available_trends';
var TWITTER_CLOSEST_TRENDS = '/twitter_api/closest_trends';
var TWITTER_SEARCH = '/twitter_api/search';
var TWITTER_TRENDS = '/twitter_api/trends';
var MAX_ZOOM = 16;
var MIN_ZOOM = 3;
var MAX_LOC = 15;
var tweetGroup;
var trendGroup;


Array.prototype.has = function(p) {
    return this.filter(p).length != 0;
}


var CreateEventGroup = function() {
    var __eventList = [];
    return {
        getEventList: function() {
            return __eventList;
        },
        push: function(e) {
            var existed = __eventList.has(function(existedEvent) {e.id == existedEvent.id;});

            if (!existed) {
                __eventList.push(e);
            }
        }
    };
};

var CreateTrendGroup = function(map) {
    var __trendingLocs = {};
    return {
        getTrends: function() {
            return __trendingLocs;
        },
        getLoc: function(woeid) {
            return __trendingLocs[woeid];
        },
        push: function(trendingLoc) {
            return __trendingLocs[trendingLoc.woeid] = trendingLoc;
        }
    };
};


var CreateTweetGroup = function($scope) {
    $scope.tweets = [];
    var __locMapping = {};
    var __topics = []
    return {
        getTweetTrendingLocs: function(tweet) {
            return __locMapping[tweet.id];
        },
        hasTopic: function(topic) {
            return __topics.has(function(t) {return t === topic});
        },
        push: function(woeid, tweet, topic) {
            if (tweet === undefined) return;
            var tweetExisted = $scope.tweets.has(function(t) {return t.id === tweet.id});
            if (!tweetExisted) {
                $scope.$apply(function() {
                    $scope.tweets.push(tweet);
                });
                __locMapping[tweet.id] = [];
            }

            var mappingExisted = __locMapping[tweet.id].has(function(w) {return w == woeid});
            if (!mappingExisted) {
                __locMapping[tweet.id].push(woeid);
            }

            if (!this.hasTopic(topic)) {
                __topics.push(topic);
            }
        },
        clear: function() {
            $scope.$apply(function() {
                $scope.tweets = [];
            });

            __topics = [];
            __locMapping = {};
        }
    }
};




var fetchTweetByTopic = function(topic, callback) {
    topic = encodeURIComponent(topic);
    $.getJSON(TWITTER_SEARCH+'?q='+topic, {}, callback);
};


// todo: make priority queue
var fetchTrends = function(woeid, callback) {
    $.getJSON(TWITTER_TRENDS+'?id='+woeid, {}, callback);
};

var processTweet = function(tweet) {
    var processedTweet;
    processedTweet = tweet;
    return processedTweet;
};


var fetchTweetsByLoc = function(woeid, tweetGroup) {
    fetchTrends(woeid, function(response) {
        response.trends.forEach(function(trend) {
            if (!tweetGroup.hasTopic(trend)) {
                fetchTweetByTopic(trend, function(searchResult) {
                    var processedTweets = searchResult.statuses.map(processTweet);
                    processedTweets.forEach(function(t) {
                        tweetGroup.push(woeid, t, trend);
                    });
                });
            }
        });
    });
};
    
var eventGroup = CreateEventGroup();




var fetchFbEvents = function(accessToken, eventGroup) {

    var eventList = [];

    var makeParam = function(param) {
        if (param === undefined) {
            param = {};
        }
        param.accessToken = accessToken;
    };


    var getEventIds = function(eventFeed) {
        var eventIds = [];
        eventFeed.forEach(function(event) {
            eventIds.push(event.id);
        });
        return eventIds;
    };

    var getFbUserId = function(callback) {
        FB.api(
            'v2.1/me',
            makeParam(),
            function(response) {
                var userId = response.id;
                callback(userId);
            });
    };

    var parseEvent = function(fbEvent) {
        var event = {
            startTime: new Date(fbEvent.start_time),
            endTime: new Date(fbEvent.end_time),
            name: fbEvent.name,
            description: fbEvent.description,
            location: fbEvent.venue,
            status: fbEvent.rsvp_status,
            id: fbEvent.id
        };
        event.location.name = fbEvent.owner.name;
        return event;
    };


    var getEventDetails = function(eventIds) {
        eventIds.forEach(function(eventId) {
            FB.api(
                'v2.1/'+eventId,
                makeParam(),
                function(response) {
                    var event = parseEvent(response);
                    eventGroup.push(event);
                });
        });
    };


    var getUserEvents = function(userId) {
        FB.api(
            'v2.1/'+userId+'/events',
            makeParam(),
            function(response) {
                var eventIds = getEventIds(response.data);
                getEventDetails(eventIds);
            });
    };

    getFbUserId(getUserEvents);
};

//todo: refactor to create a closured object to contain all of the functions used to fetch tweets

var lookupWOEID = function(woeid, callback) {
    $.getJSON('https://query.yahooapis.com/v1/public/yql',{
        q: 'select * from geo.places where woeid ="'+woeid+'"',
        format: 'json'
    }, function(response) {
        var popRank = response.query.results.place.popRank;
        var areaRank = response.query.results.place.areaRank;
        var center = response.query.results.place.centroid;
        center.latitude = parseFloat(center.latitude);
        center.longitude = parseFloat(center.longitude);
        callback({
            center: center,
            boundary: response.query.results.place.boundingBox,
            significance: Math.sqrt(areaRank) * popRank
        });
    });
};


var findTrendingLoc = function(trends, tweetGroup) {
    $.getJSON(TWITTER_AVAILABLE_TRENDS, {}, function(response) {
        response.places.forEach(function(woeid) {
            lookupWOEID(woeid, function(location) {
                trends.push({
                    woeid: woeid,
                    location: location
                });
            });
        });
    });
};




window.fbAsyncInit = function() {
    FB.init({
      appId      : fbAppId,
      xfbml      : true,
      version    : 'v2.1'
    });

    FB.login(function(response) {
        fetchFbEvents(response.authResponse.accessToken, eventGroup);
    }, {
        scope: 'user_events,user_about_me,user_activities'
    });
 
};

(function(d, s, id){
    var js, fjs = d.getElementsByTagName(s)[0];
    if (d.getElementById(id)) {return;}
    js = d.createElement(s); js.id = id;
    js.src = "//connect.facebook.net/en_US/sdk/debug.js";
    fjs.parentNode.insertBefore(js, fjs);
}(document, 'script', 'facebook-jssdk'));


var mapRegion = function(trendingLoc) {
    var bound1 = trendingLoc.location.boundary.northEast;
    var bound2 = trendingLoc.location.boundary.southWest;
    var center = trendingLoc.location.center;
    var legend;
    console.log(center);
    if (map.getZoom() > 5) {
        legend = new google.maps.Rectangle({
            strokeColor: '#FF0000',
            strokeOpacity: 0,
            strokeWeight: 2,
            fillColor: '#FF0000',
            fillOpacity: 0.4,
            map: map,
            bounds: new google.maps.LatLngBounds(
              new google.maps.LatLng(bound1.latitude, bound2.longitude),
              new google.maps.LatLng(bound2.latitude, bound1.longitude))
        }); 
    } else {
        legend = new google.maps.Marker({
            position: new google.maps.LatLng(
                center.latitude,
                center.longitude),
            map: map,
            icon: '/static/img/dot.png'
        });
    }
    return legend;
};

var fetchTweets = function() {
    var enclosedTrends = [];
    var trends = trendGroup.getTrends();
    var enclosedTrends = []
    var windowBounds = getWindowBounds();
    for (var woeid in trends) {
        var trend = trends[woeid];
        var trendCenter = trend.location.center;
        var trendLatLng = new google.maps.LatLng(
                            trendCenter.latitude,
                            trendCenter.longitude);


        if (windowBounds.contains(trendLatLng)) {
            enclosedTrends.push(trend);
        }
    }

    enclosedTrends.sort(function(a, b) {
        return a.significance - b.significance;
    });

    for (var i = 0; i < MAX_LOC && i < enclosedTrends.length; i++) {
        fetchTweetsByLoc(enclosedTrends[i].woeid, tweetGroup);
    }
};



var getWindowBounds = function() {
    var sw = map.getBounds().getSouthWest();
    var ne = map.getBounds().getNorthEast();
    var swLng = sw.lng();
    var neLng = ne.lng();
    var widthRatio = ($('#info-canvas').width() + 50.0) / $(window).width();
    console.log(widthRatio);
    if (swLng < neLng) {
        var dlng = neLng - swLng;
    } else {
        var dlng = 360 - (swLng - neLng);
    }

    console.log(dlng);
    dlng *= widthRatio;
    swLng += dlng;
    console.log(dlng);

    if (swLng > 180) {
        swLng = -180 + (swLng - 180);
    } else if (swLng < -180){
        swLng = 180 - (swLng + 180);
    }

    var windowBounds = new google.maps.LatLngBounds(
                            new google.maps.LatLng(sw.lat(), swLng),
                            ne);
    return windowBounds;
};



