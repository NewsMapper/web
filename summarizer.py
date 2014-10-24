import re
import requests
from lxml import etree




OGP_RE = re.compile(r'og:(.*)')



def get_property(ogp):
    matching = OGP_RE.match(ogp.attrib['property'])
    if matching is None or len(matching.groups()) == 0:
        return None
    return matching.group(1)



def get_content(ogp):
    return ogp.attrib['content'] 



def summarize_page(raw_page, page_encoding):
    page = etree.HTML(raw_page.encode(page_encoding))
    properties = page.xpath('//meta[starts-with(@property, "og:")]')
    return {get_property(ogp): get_content(ogp)
                for ogp in properties}


def summarize_by_url(url):
    page = requests.get(url)
    if page.status_code == 200:
        return summarize_page(page.text, page.encoding)
    else:
        return {}

