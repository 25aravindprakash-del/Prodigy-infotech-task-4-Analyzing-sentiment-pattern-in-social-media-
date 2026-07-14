import pandas as pd
import numpy as np
import json
import re
from collections import Counter

# Set up raw stop words list to avoid needing external nltk downloads
STOPWORDS = set([
    'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', "you're", "you've", "you'll", "you'd",
    'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', "she's", 'her', 'hers',
    'herself', 'it', "it's", 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves', 'what', 'which',
    'who', 'whom', 'this', 'that', "that'll", 'these', 'those', 'am', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if',
    'or', 'because', 'as', 'until', 'while', 'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between',
    'into', 'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out',
    'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
    'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
    'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', "don't", 'should',
    "should've", 'now', 'd', 'll', 'm', 'o', 're', 've', 'y', 'ain', 'aren', "aren't", 'couldn', "couldn't",
    'didn', "didn't", 'doesn', "doesn't", 'hadn', "hadn't", 'hasn', "hasn't", 'haven', "haven't", 'isn', "isn't",
    'ma', 'mightn', "mightn't", 'mustn', "mustn't", 'needn', "needn't", 'shan', "shan't", 'shouldn', "shouldn't",
    'wasn', "wasn't", 'weren', "weren't", 'won', "won't", 'wouldn', "wouldn't", 'im', 'get', 'like', 'go', 'good',
    'one', 'dont', 'cant', 'u', 'game', 'play', 'new', 'people', 'love', 'shit', 'fucking', 'fuck'
])

def clean_text(text):
    if not isinstance(text, str):
        return ""
    # Remove URLs, mentions (@user), and special characters
    text = re.sub(r"http\S+|www\S+|https\S+", "", text, flags=re.MULTILINE)
    text = re.sub(r"@\w+", "", text)
    text = re.sub(r"[^\w\s]", "", text)
    # Convert to lowercase and strip excess spaces
    return text.lower().strip()

def get_top_words(df, limit=20):
    words = []
    for text in df['cleaned_text']:
        if text:
            # Simple tokenization
            tokens = [w for w in text.split() if w not in STOPWORDS and len(w) > 2]
            words.extend(tokens)
    
    counter = Counter(words)
    return [{"word": word, "count": count} for word, count in counter.most_common(limit)]

def main():
    print("Loading twitter_training.csv...")
    try:
        # Load dataset
        df = pd.read_csv("twitter_training.csv", header=None, names=["id", "entity", "sentiment", "text"])
    except FileNotFoundError:
        print("Error: twitter_training.csv not found in the current directory.")
        return

    print(f"Original shape: {df.shape}")

    # 1. Clean Data
    print("Cleaning text and handling missing values...")
    df = df.dropna(subset=["text"])
    df["text"] = df["text"].astype(str)
    
    # Remove duplicates based on ID and text to keep analysis robust
    df = df.drop_duplicates(subset=["id", "text"])
    print(f"Shape after removing duplicates: {df.shape}")

    # Clean text for word frequency analysis
    df["cleaned_text"] = df["text"].apply(clean_text)

    # Compute tweet lengths
    df["char_length"] = df["text"].apply(len)
    df["word_count"] = df["text"].apply(lambda x: len(x.split()))

    # Filter out extreme outliers in character length (e.g. > 1000 characters) for cleaner visualizations
    df = df[df["char_length"] <= 1000]

    # Save cleaned data to CSV
    df.to_csv("cleaned_twitter_data.csv", index=False, columns=["id", "entity", "sentiment", "text", "char_length", "word_count"])
    print("Cleaned dataset saved to cleaned_twitter_data.csv")

    # 2. Generate Statistics for Dashboard JSON
    print("Calculating overall statistics...")
    total_tweets = int(len(df))
    sentiment_counts = df["sentiment"].value_counts().to_dict()
    sentiment_pct = (df["sentiment"].value_counts(normalize=True) * 100).round(1).to_dict()

    # Overall length statistics
    avg_char_len = float(df["char_length"].mean())
    avg_word_count = float(df["word_count"].mean())

    # Sentiment statistics by entity
    print("Aggregating entity-specific sentiment distribution...")
    entity_stats = {}
    entities = sorted(df["entity"].unique())
    
    for entity in entities:
        ent_df = df[df["entity"] == entity]
        ent_total = int(len(ent_df))
        ent_sent_counts = ent_df["sentiment"].value_counts().to_dict()
        
        # Ensure all four sentiments exist in the counts
        for s in ["Positive", "Negative", "Neutral", "Irrelevant"]:
            if s not in ent_sent_counts:
                ent_sent_counts[s] = 0
                
        entity_stats[entity] = {
            "total": ent_total,
            "sentiment_counts": ent_sent_counts,
            "avg_word_count": round(float(ent_df["word_count"].mean()), 1)
        }

    # Tweet length distribution by sentiment
    print("Generating tweet length histograms...")
    length_histograms = {}
    bins = list(range(0, 301, 15)) # 0 to 300 characters, in bins of 15
    
    for sentiment in ["Positive", "Negative", "Neutral", "Irrelevant"]:
        sent_df = df[df["sentiment"] == sentiment]
        counts, _ = np.histogram(sent_df["char_length"], bins=bins)
        length_histograms[sentiment] = counts.tolist()
    
    # Common words by sentiment
    print("Extracting top terms for each sentiment...")
    top_words_by_sentiment = {}
    for sentiment in ["Positive", "Negative", "Neutral", "Irrelevant"]:
        sent_df = df[df["sentiment"] == sentiment]
        top_words_by_sentiment[sentiment] = get_top_words(sent_df, limit=15)

    # Balanced sample of tweets for Tweet Explorer (100 positive, 100 negative, etc.)
    print("Sampling tweets for Explorer interface...")
    sample_dfs = []
    for sentiment in ["Positive", "Negative", "Neutral", "Irrelevant"]:
        sent_df = df[df["sentiment"] == sentiment]
        sample_dfs.append(sent_df.sample(n=min(60, len(sent_df)), random_state=42))
    
    explorer_sample = pd.concat(sample_dfs).sample(frac=1, random_state=42)[["id", "entity", "sentiment", "text", "char_length"]].to_dict(orient="records")

    # Construct final stats object
    stats = {
        "overall": {
            "total_tweets": total_tweets,
            "sentiment_counts": sentiment_counts,
            "sentiment_percentages": sentiment_pct,
            "avg_char_length": round(avg_char_len, 1),
            "avg_word_count": round(avg_word_count, 1)
        },
        "entities": entity_stats,
        "histograms": {
            "bins": bins[:-1], # Use left edges as bin labels
            "data": length_histograms
        },
        "top_words": top_words_by_sentiment,
        "sample_tweets": explorer_sample
    }

    # Save to JSON
    with open("sentiment_data.json", "w") as f:
        json.dump(stats, f, indent=2)
    print("Statistics exported to sentiment_data.json")

if __name__ == "__main__":
    main()
