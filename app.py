from flask import Flask, render_template
import json
import pandas as pd
import numpy as np
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA

app = Flask(__name__)

# ensure that we can reload when we change the HTML / JS for debugging
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
app.config['TEMPLATES_AUTO_RELOAD'] = True

def read_data():
    df = pd.read_csv('./static/data/Cleaned_dataset.csv')
    COUNTRIES = ['Afghanistan', 'Albania', 'Algeria', 'Angola', 'Argentina', 'Armenia', 'Australia', 'Austria', 'Azerbaijan', 'Brazil', 'Bulgaria', 'Cameroon', 'Chile', 'China', 'Colombia', 'Croatia', 'Cuba', 'Cyprus', 'Czech Republic', 'Ecuador', 'Egypt, Arab Rep.', 'Eritrea', 'Ethiopia', 'France',
                 'Germany', 'Ghana', 'Greece', 'India', 'Indonesia', 'Iran, Islamic Rep.', 'Iraq', 'Ireland', 'Italy', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Lebanon', 'Malta', 'Mexico', 'Morocco', 'Pakistan', 'Peru', 'Philippines', 'Russian Federation', 'Syrian Arab Republic', 'Tunisia', 'Turkey', 'Ukraine']
    df = df[df["Country Name"].isin(COUNTRIES)]
    return df

def perform_PCA(X):
    pipe = Pipeline([
        ("scaler", StandardScaler()),
        ("pca", PCA(n_components=10)),
    ])
    X_numeric = X.drop(["Country Name", "Country Code"], axis=1)
    X_PCA = pd.DataFrame(pipe.fit_transform(X_numeric), index=X_numeric.index)
    X_PCA = pd.concat([X_PCA, X[["Country Name", "Country Code"]]], axis=1)
    return X_PCA

@app.route('/')
def data():
    # replace this with the real data
    # with open('./static/data/Cleaned_dataset.csv', mode='r', newline='', encoding='utf-8') as csvfile:
    #     data = list(csv.DictReader(csvfile))


    # return the index file and the data
    df = read_data()
    pca_df = df[df["year"] == df["year"].max()]
    pca_res = perform_PCA(pca_df)
    print(pca_res)
    return render_template("index.html", data=df.to_json(orient="records"), pca_res=pca_res.to_json(orient="records"))

    # return render_template("index.html", data=df.to_json(), pca_data=pca_df.to_json())

if __name__ == '__main__':
    app.run()
