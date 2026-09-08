# Geographic trail map

`TrailMap` is an original, offline SVG cartographic interface. It is not an archival map or a reconstruction of one. Coastline/land and drainage linework are stored Natural Earth data; game route lines join the actual simulation content graph's node coordinates. The route drawing is a readable game visualization, not a historical survey alignment or navigational data.

## Stored data and provenance

- [`src/data/map/natural-earth-west.json`](../src/data/map/natural-earth-west.json) is a geometry-clipped subset (bounding box 126°W–86°W, 31°N–49°N) of Natural Earth 1:50m `ne_50m_land` and `ne_50m_rivers_lake_centerlines` physical vectors. It is projected by the same longitude/latitude function as landmarks in `TrailMap`.
- Retrieval date: 2026-09-08. Sources: `https://naturalearth.s3.amazonaws.com/50m_physical/ne_50m_land.zip` and `https://naturalearth.s3.amazonaws.com/50m_physical/ne_50m_rivers_lake_centerlines.zip`.
- SHA-256: land ZIP `0b8e670cf80dce9cbebe2a193bc44ba5602758c22e1fa603980553646d7ff162`; rivers ZIP `c607d9d7e7702827a7996fff6dc17b87a338c5ed3b52d12c402e0c9669cc7b56`; stored subset `30d03785a715a47381e9ba80a655edbd338e5a9ddf4756baecded13c1e9adae4`.
- [Natural Earth’s physical-vector catalogue](https://www.naturalearthdata.com/downloads/50m-physical-vectors/) documents the land and rivers/lake-centerlines layers. Natural Earth data are public domain.
- The National Park Service’s [GIS Data Products page](https://home.nps.gov/orgs/1453/gis-data.htm) links the authoritative designated alignment datasets for Oregon, California and Mormon Pioneer National Historic Trails. This component does **not** claim to embed those alignments.
- Historical context only: the Library of Congress describes the Preuss/Fremont 1846 seven-sheet Oregon-road map in its [American Treasures collection](https://loc.gov/exhibits/treasures/tr11b.html?loclr=loc-3d).

## Simulation relationship

`src/data/map/trail-node-coordinates.ts` maps every current node ID from `engine/crates/data/content.ron` to longitude/latitude. `TrailMap` reads `view.content.trails` and uses each node’s engine routes; it does not choose routes or alter any simulation state.

## Historic-place coordinate notes

- `fort_boise` uses the center of the National Register boundary (about 43.819°N, 117.009°W), near the Boise–Snake confluence and northwest of Parma—not the modern city of Boise. The NPS [Fort Boise Site](https://www.nps.gov/places/fort-boise-site.htm) says the exact post location is lost but was within the present Fort Boise Wildlife Management Area; the [National Register record](https://npgallery.nps.gov/GetAsset/31e25d29-3236-419e-afb6-39da836ff5a5) supplies the boundary coordinates.
- `fort_walla_walla` uses the historic Fort Nez Perces/Fort Walla Walla location near Wallula Junction (about 46.08°N, 118.90°W), rather than the later military fort at modern Walla Walla. The NPS [Columbia Gorge history](https://www.nps.gov/articles/000/overlanders-in-the-columbia-river-gorge-1840-1870-a-narrative-history.htm) identifies the 1818 fort at the Walla Walla–Columbia confluence.
