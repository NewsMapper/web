Array.prototype.has = function(p) {
    return this.filter(p).length != 0;
}

var TWITTER_AVAILABLE_TRENDS = '/twitter_api/available_trends';
var TWITTER_CLOSEST_TRENDS = '/twitter_api/closest_trends';
var TWITTER_SEARCH = '/twitter_api/search';
var TWITTER_TRENDS = '/twitter_api/trends';

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

var CreateTrendGroup = function() {
    var __trendingLocs = [];
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
        }
    }
};



var CreateRequestQueue = function(interval) {
    var __requests = [];
    var __running = false;
    var __interval = interval*1000;


    var __dispatch = function() {
        var request = __requests.dequeue();
        $.getJSON(request.url, {}, function(response) {
            if (__requests.length > 0) {
                setTimeout(__dispatch, __interval);
            } else {
                __running = false;
            }
            request.callback(response);
        });
    };

    __requests.dequeue = function() {
        return Array.prototype.shift.apply(this);
    };


    __requests.push = function(request) {
        Array.prototype.push.apply(this, [request]);

        if (!__running) {
            __dispatch();
            __running = true;
        }
    };

    return {
        enqueue: function(request) {
            __requests.push(request);
        }
    };
};



var tweetFetchingQueue = CreateRequestQueue(5);
var fetchTweetByTopic = function(topic, callback) {
    topic = encodeURIComponent(topic);
    tweetFetchingQueue.enqueue({
        url: TWITTER_SEARCH+'?q='+topic+'&result_type=popular',
        callback: callback
    });
};


// todo: make priority queue
var tweetTrendFetchingQueue = CreateRequestQueue(5*60);
var fetchTrends = function(woeid, callback) {
    tweetTrendFetchingQueue.enqueue({
        url: TWITTER_TRENDS+'?id='+woeid,
        callback: callback
    });
};

var processTweet = function(tweet) {
    var processedTweet;
    processedTweet = tweet;
    return processedTweet;
};


var fetchTweetsByLoc = function(woeid, tweetGroup) {
    fetchTrends(woeid, function(response) {
        response.trends[0].trends.forEach(function(trend) {
            if (!tweetGroup.hasTopic(trend.name)) {
                fetchTweetByTopic(trend.name, function(searchResult) {
                    var processedTweets = searchResult.statuses.map(processTweet);
                    processedTweets.forEach(function(t) {
                        tweetGroup.push(woeid, t, trend.name);
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
        callback({
            center: response.query.results.place.centroid,
            boundary: response.query.results.place.boundingBox
        });
    });
};


var findTrendingLoc = function(trends, tweetGroup) {
    $.getJSON(TWITTER_AVAILABLE_TRENDS, {}, function(response) {
        response.places.forEach(function(trend) {
            lookupWOEID(trend.woeid, function(location) {
                trends.push({
                    woeid: trend.woeid,
                    location: location
                });
                fetchTweetsByLoc(trend.woeid, tweetGroup);
            });
        });
    });
};




window.fbAsyncInit = function() {
    FB.init({
      appId      : '470801286396139',
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








