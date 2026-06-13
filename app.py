import json
import os

from flask import Flask, render_template


app = Flask(__name__)

_VERSION_PATH = os.path.join(os.path.dirname(__file__), "version.json")
with open(_VERSION_PATH) as f:
    VERSION = json.load(f)


@app.route("/")
def index():
    return render_template("index.html", version=VERSION)


@app.route("/health")
def health():
    return {"status": "healthy"}, 200


# SEO assets — also exposed at the root path for crawlers that look there
# rather than under /static/.
@app.route("/robots.txt")
def robots():
    return app.send_static_file("robots.txt")


@app.route("/sitemap.xml")
def sitemap():
    return app.send_static_file("sitemap.xml")


@app.route("/manifest.json")
def manifest():
    return app.send_static_file("manifest.json")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
