var TWITTER_AVAILABLE_TRENDS = '/twitter_api/available_trends';
var TWITTER_CLOSEST_TRENDS = '/twitter_api/closest_trends';
var TWITTER_SEARCH = '/twitter_api/search';
var TWITTER_TRENDS = '/twitter_api/trends';
var REDDIT_AVAILABLE_SUBREDDITS = '/reddit_api/r';
var REDDIT_SUBREDDIT = '/reddit_api/r/';
var SUMMARY_URL = '/summary';
var MAX_ZOOM = 16;
var MIN_ZOOM = 3;
var MAX_REQUESTS = 20;
var SENT_REQUEST = 0;
var tweetGroup;
var trendGroup;
var curRedditId = 1;
var MAX_ITEM = 200;
var ITEM_COUNT = 0;
var SUMMARY_HTTP = {abort:function(){}};


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
    var __fetchFuncs = {};
    return {
        getTrends: function() {
            return __trendingLocs;
        },
        getLoc: function(woeid) {
            var loc = __trendingLocs[woeid];
            loc.fetchFuncs = __fetchFuncs[woeid];

            return loc
        },
        push: function(trendingLoc, fetchFunc) {
            if (__trendingLocs[trendingLoc.woeid] === undefined ||
                    __trendingLocs[trendingLoc.woeid].rid === undefined) {
                __trendingLocs[trendingLoc.woeid] = trendingLoc;
            }

            if (__fetchFuncs[trendingLoc.woeid] !== undefined) {
                __fetchFuncs[trendingLoc.woeid].push(fetchFunc);
            } else {
                __fetchFuncs[trendingLoc.woeid] = [fetchFunc];
            }
        }
    };
};

// todo: rename this to reflect the fact that this also holds reddits and other media item
var CreateTweetGroup = function($scope) {
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

            var tweetExisted = $scope.tweets.has(function(t) {
                if (t.id != tweet.id) {
                    return false;
                } else {
                    return t.source == tweet.source;
                }
            });


            if (!tweetExisted && ITEM_COUNT < MAX_ITEM) {
                $scope.$apply(function() {
                    tweet.side = randomSide();
                    $scope.tweets.push(tweet);
                });
                ITEM_COUNT ++;
            }

            if (__locMapping[tweet.id] === undefined) {
                __locMapping[tweet.id] = [];
            }
    

            var mappingExisted = __locMapping[tweet.id].has(function(w) {return w == woeid});
            if (!mappingExisted) {
                __locMapping[tweet.id].push(woeid);
            }

            if (topic !== undefined && !this.hasTopic(topic)) {
                __topics.push(topic);
            }
        },
        clear: function() {
            $scope.$apply(function() {
                $scope.tweets = [];
            });
            ITEM_COUNT = 0; 
            __topics = [];
            __locMapping = {};
        }
    }
};




var fetchTweetByTopic = function(topic, callback) {
    topic = encodeURIComponent(topic);
    $.getJSON(TWITTER_SEARCH+'?q='+topic, {}, callback);
};


var fetchSubreddit = function(rid, callback) {
    $.getJSON(REDDIT_SUBREDDIT+rid, {}, callback);
}


var fetchTrends = function(woeid, callback) {
    $.getJSON(TWITTER_TRENDS+'?id='+woeid, {}, callback);
};



var fetchTweetByLoc = function(loc, tweetGroup) {
    var woeid = loc.woeid;
    fetchTrends(woeid, function(response) {
        response.trends.forEach(function(trend) {
            if (!tweetGroup.hasTopic(trend)) {
                fetchTweetByTopic(trend, function(searchResult) {
                    searchResult.statuses.forEach(function(t) {
                        t.source = 'twitter';
                        tweetGroup.push(woeid, t, trend);
                    });
                });
            }
        });
    });
};


var fetchRedditByLoc = function(loc, tweetGroup) {
    var woeid = loc.woeid;
    var rid = loc.rid;
    if (rid === undefined) {
        return;
    }

    fetchSubreddit(rid, function(response) {
        response.topics.forEach(function(topic) {
            topic.source = 'reddit';
            topic.id = curRedditId++;
            tweetGroup.push(woeid, topic);
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


var lookupWOEID = function(query, callback) {
    var q = 'select * from geo.places where woeid="'+query+'"';

    $.getJSON('https://query.yahooapis.com/v1/public/yql',{
        q: q,
        format: 'json'
    }, function(response) {
        if (response.query.count === 0) {
            return;
        }

        var place = response.query.results.place;

        if (place === undefined) {
            return;
        }

        var center = place.centroid;

        center.latitude = parseFloat(center.latitude);
        center.longitude = parseFloat(center.longitude);
        callback({
            center: center,
            boundary: place.boundingBox,
            woeid: place.woeid
        });
    });
};


var findTrendingTweetLoc = function(trends, tweetGroup) {
    $.getJSON(TWITTER_AVAILABLE_TRENDS, {}, function(response) {
        response.places.forEach(function(woeid) {
            lookupWOEID(woeid, function(location) {
                trends.push({
                    woeid: woeid,
                    location: location,
                }, fetchTweetByLoc);
            });
        });
    });
};



var findTrendingRedditLoc = function(trends, redditGroup) {
    $.getJSON(REDDIT_AVAILABLE_SUBREDDITS, {}, function(response) {
        response.subreddits.forEach(function(subreddit) {
            var location = jQuery.extend(true, {}, subreddit.location);
            delete subreddit.location;
            trends.push({
                woeid: location.woeid,
                location: location,
                rid: subreddit.rid,
            }, fetchRedditByLoc);
        });
    });
}








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
    var bound1 = trendingLoc.location.boundary.southWest;
    var bound2 = trendingLoc.location.boundary.northEast;
    var center = trendingLoc.location.center;
    var legend; 


    if (map.getZoom() > 5 || trendingLoc.location.area > 8) {
        legend = new google.maps.Rectangle({
            strokeColor: '#FF0000',
            strokeOpacity: 0,
            strokeWeight: 2,    
            fillColor: '#FF0000',
            fillOpacity: 0.4,
            map: map,
            bounds: new google.maps.LatLngBounds(
              new google.maps.LatLng(parseFloat(bound1.latitude), parseFloat(bound1.longitude)),
              new google.maps.LatLng(parseFloat(bound2.latitude), parseFloat(bound2.longitude)))
        }); 
    } else if (trendingLoc.woeid !== 1) {
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

var fetchItems = function() {
    var trends = trendGroup.getTrends();
    var windowBounds = getWindowBounds();
    SENT_REQUEST = 0;

    for (var woeid in trends) {
        var trend = trendGroup.getLoc(woeid);
        var trendCenter = trend.location.center;
        var trendLatLng = new google.maps.LatLng(
                            trendCenter.latitude,
                            trendCenter.longitude);


        if (windowBounds.contains(trendLatLng)) {
            trend.fetchFuncs.forEach(function(fetchFunc) {
                if (canSend()) {
                    SENT_REQUEST ++;
                    fetchFunc(trend, tweetGroup);
                }
            });

        }

        if (!canSend()) {
            break;
        }
    }


};




var getWindowBounds = function() {
    var sw = map.getBounds().getSouthWest();
    var ne = map.getBounds().getNorthEast();
    var swLng = sw.lng();
    var neLng = ne.lng();
    var widthRatio = ($('#info-canvas').width() + 50.0) / $(window).width();
    if (swLng < neLng) {
        var dlng = neLng - swLng;
    } else {
        var dlng = 360 - (swLng - neLng);
    }

    dlng *= widthRatio;
    swLng += dlng;

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


var randomSide = function() {
    if (Math.floor(Math.random() * 2) == 1) {
        return "left";
    } else {
        return "right";
    }
};


var canSend = function() {
    return (ITEM_COUNT < MAX_ITEM &&
           SENT_REQUEST < MAX_REQUESTS);
};




var summarize = function(item) {
    return setTimeout(function() {
        showSummary(item);
    }, 300);
};


var showSummary = function(item) {
    if (item.source !== 'reddit') {
        return;
    }
    var summaryHTML = '<div style="padding: 5px;"><div id="summary-title"></div><div><img id="summary-image" class="content-image"/></div><div id="summary-description"></div></div>';
    $('#summary').html(summaryHTML);
    SUMMARY_HTTP = $.getJSON(SUMMARY_URL, {'url': item.title.link}, function(summary) {
        if (Object.keys(summary).length === 0) {
            return;
        }
        $('#summary-title').html(summary.title);
        $('#summary-image').attr('src', summary.image);
        $('#summary-description').html(summary.description);
        $('#summary').fadeIn('fast');
    });
};



var clearSummary = function() {
    $('#summary').fadeOut('fast');
    $('#summary').html('');    
    SUMMARY_HTTP.abort();
};






























