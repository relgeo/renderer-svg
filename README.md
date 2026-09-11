# RelGeo Renderer SVG

Renderer SVG untuk resolved geometry RelGeo.

Package ini bertanggung jawab mengubah hasil resolve runtime menjadi surface SVG yang dapat dipakai oleh playground, CLI, dan alur export ringan.

Ia mengikuti kontrak bahasa aktif `RelGeo DSL v0.5`, yang disajikan melalui website pada `/docs/language-spec/`.

Metadata package `relgeo-renderer-svg` saat ini adalah `0.4.0`. Versi renderer package terpisah dari kontrak DSL `v0.5`; publish atau release publik memerlukan workflow tersendiri.

Status packaging saat ini:

* package ini adalah renderer library surface
* konsumsi utamanya saat ini datang dari package workspace lain di monorepo RelGeo
* ia bukan source of truth bahasa, melainkan lapisan render untuk kontrak yang ditetapkan oleh `relgeo/spec`

Pakai package ini jika Anda ingin:

* merender resolved scene RelGeo ke SVG
* meng-embed output RelGeo ke web, docs, atau export SVG ringan
* membangun surface visual di atas runtime tanpa menulis renderer sendiri

Jika yang Anda butuhkan berbeda:

* gunakan `relgeo-core` untuk menghasilkan resolved scene
* gunakan `relgeo-cli` bila hanya ingin compile dari terminal
* gunakan `relgeo-playground` bila ingin UI interaktif siap pakai

Dalam monorepo ini:

```bash
pnpm install
```

Peran package ini di repo:

* renderer utama untuk `relgeo-playground`
* renderer SVG untuk `relgeo-cli`
* tempat eksperimen render yang tetap terpisah dari resolver geometry inti

Catatan konseptual:

* package ini menerima resolved scene dari runtime, bukan intent mentah dari DSL
* ia dapat merender surface yang bersifat umum maupun surface presentasi/domain seperti technical drawing yang hidup di atas kontrak aktif

Metadata inspeksi pada output SVG:

* renderer dapat memproyeksikan metadata resolved tertentu ke atribut `data-*`
* field yang saat ini diproyeksikan adalah `role`, `intent`, `metaPreset`/`style`, dan `label`
* proyeksi ini ditujukan untuk inspection, tooling, dan debug, bukan untuk mengubah geometri
* jejak asal merge seperti `meta.inherit` tidak dijamin tersedia pada tahap render karena renderer bekerja pada resolved scene

Catatan render surface aktif:

* hasil `split` yang sudah di-resolve sebagai piece path akan dirender seperti path biasa
* jika hasil `split` hadir sebagai `collection`, renderer memperlakukan collection itu sebagai wrapper struktur, sementara child path-nya tetap dirender normal

Dokumen terkait:

* kontrak bahasa aktif: `RelGeo DSL v0.5`, disajikan melalui website pada `/docs/language-spec/`
* dokumentasi publik dan contoh penggunaan: [relgeo.github.io](https://relgeo.github.io/)
