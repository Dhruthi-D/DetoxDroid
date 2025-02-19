import sys
import json
from textblob import TextBlob #text process lib

def analyze_sentiment(text):
    blob = TextBlob(text)
    sentiment = blob.sentiment
    return {
        'polarity': sentiment.polarity,
        'subjectivity': sentiment.subjectivity
    }

if __name__ == "__main__":
    try:
        if len(sys.argv) < 2: #atleast one cli arg
            raise ValueError("No text input provided for analysis")
        text = sys.argv[1]
        sentiment = analyze_sentiment(text)
        print(json.dumps(sentiment))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
