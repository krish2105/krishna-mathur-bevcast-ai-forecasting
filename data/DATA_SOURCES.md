# Data sources

Every number in BEVCAST AI carries one of four labels:

| Label | Meaning |
|---|---|
| **Real** | Observed data from an official public source |
| **Simulated** | Teaching data from the professor's reference notebook; not observed sales |
| **Proxy** | Real category-level data standing in for the company's own sales |
| **Live** | Fetched from a public API at request time; shown with its retrieval timestamp |

## 1. FRED IPN31211N: soft drink and ice production index (Part 2)

| Item | Detail |
|---|---|
| Name | Industrial Production: Manufacturing: Non-Durable Goods: Soft Drink and Ice (NAICS = 31211) |
| Series code | IPN31211N |
| Publisher | Board of Governors of the Federal Reserve System (US); distributed by FRED, Federal Reserve Bank of St. Louis |
| URL | https://fred.stlouisfed.org/series/IPN31211N |
| Download endpoint | https://fred.stlouisfed.org/graph/fredgraph.csv?id=IPN31211N |
| Release | G.17 Industrial Production and Capacity Utilization |
| Licence / terms | Tagged on FRED as "Public Domain: Citation Requested" (checked 12 Nov 2026). Cite the Board of Governors of the Federal Reserve System and FRED; FRED terms: https://fred.stlouisfed.org/legal/ |
| Accessed | 12 Nov 2026, 09:37 UTC (live download during the notebook run) |
| File | `notebook/data/fred_IPN31211N_soft_drink_production.csv` |
| Rows × columns | 657 × 2 (`observation_date`, `IPN31211N`) |
| Coverage | Jan 1972 – Sep 2026, monthly. The analysis uses Jan 2012 – Sep 2026 (177 months) |
| Unit | Index, 2017 = 100, **not seasonally adjusted** |
| Label | **Proxy**: real, official category data used in place of the company's own sales, which are not public |
| Limitations | US national aggregate of all soft drinks and bottled water, not one brand or region. The Federal Reserve revises recent values, so a later download can differ slightly. A single new brand would swing more and have higher forecast errors. |

## 2. Open-Meteo Historical Weather API: Dubai 2023 monthly temperature (Part 1)

| Item | Detail |
|---|---|
| Name | Daily mean and max 2 m air temperature, Dubai, UAE (25.2048 N, 55.2708 E), averaged to months |
| Publisher | Open-Meteo (ERA5 reanalysis from Copernicus / ECMWF) |
| URL | https://open-meteo.com/en/docs/historical-weather-api |
| Licence / terms | CC BY 4.0 (attribution: "Weather data by Open-Meteo.com"). The free API is for non-commercial use, which includes educational use (checked 12 Nov 2026): https://open-meteo.com/en/terms |
| Accessed | 12 Nov 2026 (live request during the notebook run) |
| File | `notebook/data/openmeteo_dubai_2023_monthly_temperature.csv` |
| Rows × columns | 12 × 3 (`month`, `temp_mean_c`, `temp_max_c`) |
| Coverage | Jan – Dec 2023 |
| Unit | °C |
| Label | **Real** |
| Limitations | Reanalysis grid value, not a single weather station. Dubai is used as the climate driver; a retailer elsewhere should use its own local weather. |

## 3. Air-cooler demand, Jan – Dec 2023 (Part 1)

| Item | Detail |
|---|---|
| Values | 80, 95, 130, 160, 180, 200, 220, 210, 170, 140, 110, 90 units |
| Source | The professor's reference Google Colab notebook for the Session II lab, which labels them "simulated monthly demand" |
| Label | **Simulated** teaching data |
| Limitations | Not observed company sales. With 12 points, all model comparisons have wide uncertainty. No promotion calendar was provided, so promotions are not modelled. |

## 4. Live feeds used by the web app at request time

| Feed | Endpoint | Refresh | Label |
|---|---|---|---|
| FRED latest observations | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=IPN31211N` | Server fetch, revalidated every 6 h | **Live** |
| Open-Meteo 16-day forecast | `https://api.open-meteo.com/v1/forecast` (daily `temperature_2m_max`, 16 days) | Server fetch, revalidated every 6 h | **Live** |
| Open-Meteo same dates last year | `https://archive-api.open-meteo.com/v1/archive` | Server fetch, revalidated every 6 h | **Real** (historical) |

Cities: New York, Los Angeles, Chicago, Houston and Atlanta (same as the notebook), plus Dubai for the Part 1 context.

## 5. Derived reference results

`data/part1.json`, `data/part2.json`, `data/series.json` and `data/meta.json` are produced by `scripts/export_results.py`. It re-runs the executed notebook's own code offline against the two CSV files above and asserts that every table and printed result equals the notebook's saved output (361 checks). `meta.json` records the notebook's SHA-256 hash and the library versions.

## 6. User uploads

CSV files uploaded on the Data Workspace page are parsed **in the browser** only. They are never sent to or stored on the server, and never committed. Only aggregated monthly values (at most 240 points) are sent to the Copilot, and only when the user asks it a question. The Copilot runs on Google's Gemini API; on Google's free tier, Google may use submitted content to improve its products, so users are asked not to enter personal data.
