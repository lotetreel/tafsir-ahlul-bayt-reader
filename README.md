# Tafsir Ahlul Bayt Reader Site

This repository is a deploy-ready static build of the Quran + Tafsir reader.

It includes:

- the reader UI
- generated per-surah JSON data under `data/`
- no raw export or translation workflow files

## Run locally

```powershell
py -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000).

## Deploy to Firebase Hosting

This repo is configured for Firebase multi-site hosting in the `mizan-al-hikmah` project.

```powershell
firebase deploy --only hosting:reader --project mizan-al-hikmah
```

Current hosting URL:

- [https://tafsir-ahlulbayt.web.app](https://tafsir-ahlulbayt.web.app)

## Source control

This static site is also tracked in GitHub:

- [https://github.com/lotetreel/tafsir-ahlul-bayt-reader](https://github.com/lotetreel/tafsir-ahlul-bayt-reader)
