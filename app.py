from flask import Flask, render_template, request, redirect, make_response, url_for, jsonify
import redis
import simplejson as json
import uuid
from twython import Twython
from config import *

app = Flask(__name__)
r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT)
TW_REDIS_KEY_PREFIX = "TW_REDIS"
TW_CB = '%s/recv_twcb' % HOST_URL


def get_tw_redis_key(user_id):
    return '%s:%s' % (TW_REDIS_KEY_PREFIX, user_id)


def cache_tw_oauth(tw_credentials, user_id=None):
    if user_id is None:
        user_id = gen_user_id()
    r.set(get_tw_redis_key(user_id), json.dumps(tw_credentials))
    return user_id


def get_tw_oauth(user_id):
    oauth_val = r.get(get_tw_redis_key(user_id))
    if oauth_val is None:
        return None
    else:
        return json.loads(oauth_val)


def gen_user_id():
    user_id = uuid.uuid4()
    while get_tw_oauth(user_id) is not None:
        user_id = uuid.uuid4()
    return str(user_id)


bad_request = ('bad request', 400)



@app.route('/')
def index():
    if request.cookies.get('user_id') is None:
        return redirect(url_for('redirect_to_twitter'))

    return render_template('index.html')



@app.route('/redirect_tw')
def redirect_to_twitter():
    twitter_oauth_client = Twython(TWITTER_APP_KEY, TWITTER_APP_SECRET)
    auth = twitter_oauth_client.get_authentication_tokens(callback_url=TW_CB)
    user_id = cache_tw_oauth(auth)
    response = redirect(auth['auth_url'])
    response.set_cookie('user_id', user_id)
    return response
    



@app.route('/recv_twcb')
def receive_twitter_callback():
    oauth_verifier = request.args['oauth_verifier']
    user_id = request.cookies['user_id']
    auth = get_tw_oauth(user_id)
    twitter_oauth_client = Twython(TWITTER_APP_KEY,
                                 TWITTER_APP_SECRET,
                                 auth['oauth_token'],
                                 auth['oauth_token_secret'])
    credentials = twitter_oauth_client.get_authorized_tokens(oauth_verifier)
    cache_tw_oauth(credentials, user_id=user_id)
    return redirect('/')



@app.route('/twitter_api/<endpoint>')
def search_twitter(endpoint):
    user_id = request.cookies.get('user_id')
    if user_id is None:
        return bad_request
    auth = get_tw_oauth(user_id)

    if auth is None:
        return bad_request

    twitter_oauth_client = Twython(TWITTER_APP_KEY,
                                TWITTER_APP_SECRET,
                                auth['oauth_token'],
                                auth['oauth_token_secret'])

    if endpoint == 'search':
        result = twitter_oauth_client.search(**request.args)
    elif endpoint == 'closest_trends':
        result = {'places': twitter_oauth_client.get_closest_trends(**request.args)}
    elif endpoint == 'trends':
        result = {'trends': twitter_oauth_client.get_place_trends(**request.args)}
    elif endpoint == 'available_trends':
        result = {'places': twitter_oauth_client.get_available_trends(**request.args)}
    else:
        return bad_request

    return jsonify(result)








if __name__ == '__main__':
	app.run(debug=True)
