from flask import Flask, render_template, request, redirect, make_response, url_for, jsonify
import redis
import simplejson as json
import uuid
from datetime import datetime, timedelta
from calendar import timegm
from config import *

app = Flask(__name__)
r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT)

TW_TRENDING = 'TW:TRENDING_TOPICS'
TW_TRENDING_LOCS = 'TW:TRENDING_LOCS'
TW_TRENDING_LOC = 'TW:TRENDING'

def get_tweet_key(topic):
    return '%s:%s'% (TW_TRENDING, topic)

def get_loc_key(loc):
    return '%s:%s'% (TW_TRENDING_LOC, loc)


def tw_search(topic):
    key = get_tweet_key(topic)
    val = r.get(key)
    if val is not None:
        return json.loads(val.decode('utf-8'))


def tw_available_trends():
    trending_locs = r.lrange(TW_TRENDING_LOCS, 0, -1)
    return map(int, trending_locs)


def tw_trends(woeid):
    key = get_loc_key(woeid)
    val = r.get(key)
    return json.loads(val.decode('utf-8'))


bad_request = ('bad request', 400)


@app.route('/')
def index():
    return render_template('index.html', fb_id=FACEBOOK_APP_ID)



@app.route('/twitter_api/<endpoint>')
def search_twitter(endpoint):
    if endpoint == 'search':
        result = tw_search(request.args['q'])
    elif endpoint == 'available_trends':
        result = {'places': tw_available_trends()}
    elif endpoint == 'trends':
        result = {'trends': tw_trends(request.args['id'])}
    else:
        return bad_request

    response = jsonify(result)
    response.cache_control.max_age = 1200
    return response








if __name__ == '__main__':
	app.run(debug=True)
