# Analyzing Sentiment Patterns in Social Media Data

This repository contains the code and artifacts for Task 4 of the Prodigy InfoTech Data Science Internship.

## Project Overview

The goal of this task is to analyze and visualize sentiment patterns in social media data (Twitter) to understand public opinion and attitudes towards specific topics, brands, or entities. 

The project uses the Twitter Entity Sentiment dataset, which contains tweets categorized into four sentiments (`Positive`, `Negative`, `Neutral`, and `Irrelevant`) across 32 unique entities including gaming brands (e.g., Overwatch, Borderlands), tech companies (e.g., Google, Nvidia, Microsoft), and consumer brands.

## File Structure

* `twitter_training.csv`: The raw Twitter sentiment dataset (~74,682 records).
* `process_data.py`: A Python cleaning and aggregation script that prepares the data and outputs stats to JSON.
* `sentiment_data.json`: Pre-processed and aggregated metrics (sentiments, top words, lengths) used by the dashboard.
* `cleaned_twitter_data.csv`: The cleaned version of the Twitter dataset.
* `sentiment_analysis.ipynb`: A Jupyter Notebook walking through the step-by-step Exploratory Data Analysis (EDA) and visualizations.
* `index.html`: The HTML layout for the interactive sentiment dashboard.
* `style.css`: Sleek, dark-slate glassmorphic dashboard styling.
* `app.js`: JavaScript controller that renders Chart.js charts and handles the interactive search, filters, and pagination.

## How to Run Locally

### 1. Data Processing
Run the Python script to clean the data and generate the JSON file required by the dashboard:
```bash
python process_data.py
```

### 2. View the Dashboard
To prevent local CORS policy restrictions when fetching the JSON file, start a simple local HTTP server from the project directory:
```bash
python -m http.server 8000
```
Then, open your web browser and navigate to:
```
http://localhost:8000
```

### 3. View the Jupyter Notebook
Open the notebook in your Jupyter environment to review the step-by-step data exploration and analysis pipeline:
```bash
jupyter notebook sentiment_analysis.ipynb
```
