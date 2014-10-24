from flask import Flask, render_template, request, redirect, make_response, url_for, jsonify
import redis
import simplejson as json
import ast
import uuid
from datetime import datetime, timedelta
from calendar import timegm
from config import *
from random import shuffle
from summarizer import summarize_by_url

app = Flask(__name__)
r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT)

TW_TRENDING = 'TW:TRENDING_TOPICS'
TW_TRENDING_LOCS = 'TW:TRENDING_LOCS'
TW_TRENDING_LOC = 'TW:TRENDING'
REDDIT_SUBREDDITS = 'REDDIT:SUBREDDITS'
REDDIT_SUBREDDIT = 'REDDIT:SUBREDDIT'


def get_subreddit_key(rid):
    return '%s:%s' % (REDDIT_SUBREDDIT, rid)

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



not_found = ('not found', 404)



@app.route('/')
def index():
    return render_template('index.html', fb_id=FACEBOOK_APP_ID)



@app.route('/twitter_api/<endpoint>')
def search_twitter(endpoint):
    if endpoint == 'search':
        result = tw_search(request.args['q'])
    elif endpoint == 'available_trends':
        trending_locs = map(int, tw_available_trends())
        shuffle(trending_locs)
        result = {'places': trending_locs}
    elif endpoint == 'trends':
        result = {'trends': tw_trends(request.args['id'])}
    else:
        return not_found

    response = jsonify(result)
    response.cache_control.max_age = 1200
    return response





@app.route('/reddit_api/r')
def search_available_subreddits():
    subreddits = r.lrange(REDDIT_SUBREDDITS, 0, -1)
    response = jsonify({'subreddits': map(ast.literal_eval, subreddits)})
    response.cache_control.max_age = 1800
    return response



@app.route('/reddit_api/r/<rid>')
def get_subreddit(rid):
    key = get_subreddit_key(rid.lower())
    subreddit = r.get(key)
    if subreddit is None:
        return not_found
    
    response = jsonify({'topics': json.loads(subreddit)})
    response.cache_control.max_age = 1800
    return response


@app.route('/summary')
def summarize():
    url = request.args['url']
    try:
        summary = summarize_by_url(url)
    except Exception:
        summary = {}
    
    response = jsonify(summary)
    response.cache_control.max_age = 86400
    return response





if __name__ == '__main__':
	app.run(debug=True)
