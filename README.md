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

## Publish on GitHub Pages

1. Create an empty GitHub repository.
2. Add that repo as `origin`.
3. Push the `main` branch.
4. In the repository settings, enable GitHub Pages from the default branch root.
