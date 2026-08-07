# CLAUDE.TR.md

> 🇬🇧 English: [CLAUDE.md](CLAUDE.md) — **araçlar o dosyayı okur**, bu dosya insan okuru için
> çeviridir. Kurallar değiştiğinde ikisini birden güncelle.

Bu repoda çalışırken Claude Code'un uyacağı kurallar. Kurulum ve komutlar README-TR.md'de;
burada sadece KURALLAR var.

## Proje

pnpm monorepo içinde NestJS + TypeScript + Drizzle (PostgreSQL) API iskeleti. `apps/api`
çalışmaya hazır; `apps/web` boş (framework proje başlarken seçilir) ve `packages/shared` iki
ucun paylaştığı sabitleri, tipleri ve API client'ını tutar.

## Stack

| Katman  | Seçim                                                                                                     |
| ------- | --------------------------------------------------------------------------------------------------------- |
| Backend | NestJS 11 + Express 5 + `ws`, `/api/v1/*` altında REST, TypeScript, **CommonJS**                          |
| DB      | PostgreSQL 16 + Drizzle ORM (hiçbir yerde Prisma yok)                                                     |
| Auth    | **httpOnly cookie**'de JWT (access 15 dk + refresh 30 gün, DB'de takip edilir), roller: `admin` \| `user` |
| Doküman | class-validator DTO'larından üretilen Swagger, `/api/docs`, sadece development                            |
| Deploy  | Docker Compose; Traefik compose dosyasında DEĞİL, VPS'teki ortak instance                                 |

## API nasıl bölünmüş (modül önce)

`apps/api/src` katmana göre değil MODÜLE göre bölünür — bir iş, açılacak bir klasör.

```
src/
├─ main.ts        bootstrap
├─ app.module.ts  HER modül; önce altyapı (core), sonra özellikler (modules)
├─ core/          MODÜLE ÖZGÜ HİÇBİR ŞEY YOK: config, db, health, http, realtime, security,
│                 storage, utils
└─ modules/       auth/ example/ uploads/
```

Bir modülün içi: `<ad>.service.ts` (DB ile konuşan tek katman) + `<ad>.controller.ts` + `dto/` +
`<ad>.module.ts` + `index.ts`. Bir modül birden fazla kitleye hizmet ediyorsa HTTP yüzeyi
dosyaya göre ayrılır (`public-<ad>.controller.ts`); servis ve şema tek kopya kalır.

**İki kural (asla bozma):**

1. **Modüller birbirine sadece `index.ts` üzerinden ulaşır.** `modules/x/` içinden
   `modules/y/y.service` import edilmez.
2. **`core` hiçbir modüle bağlı değildir.** core'daki bir dosyanın modüle ihtiyacı varsa tasarım
   yanlıştır (token imzalamak core'un, login endpoint'i modülün işidir).

Controller'lar HTTP yüzeyini yönetir: içeri DTO, dışarı `ServiceResponse`. Sorgu kurmazlar ve
response zarfını kurmazlar — `success`/`timestamp` alanlarını `ResponseTransformInterceptor`
ekler. Servisler mesajı stabil bir KOD olan Nest HTTP exception'ları fırlatır
(`throw new NotFoundException('example_not_found')`).

## Sözleşme ve validasyon

- İstek validasyonu **class-validator DTO'ları** + `@ApiProperty` ile yapılır — Swagger bunlardan
  üretilir, böylece dokümante edilen endpoint ile valide edilen endpoint birbirinden ayrılamaz.
- `packages/shared` İKİ ucun da ihtiyaç duyduğunu tutar: rol/durum listeleri, upload limitleri,
  response tipleri ve tipli API client. Enum listeleri orada tanımlanır ve `pgEnum` tarafından
  kullanılır; veritabanı tipi ile client tipi birbirinden kayamaz.
- shared'ın Nest'e runtime bağımlılığı yoktur ve API shared'ın `dist`'ine karşı derlenir — ilk
  `api` build'inden önce `pnpm --filter shared build`.
- Tekrar eden normalizasyonlar (`trim`, `trimLowercase`) her DTO'nun içine değil
  `core/http/transforms.ts`'e yazılır.
- Route parametreleri WHERE'e kadar gider, bu yüzden `:id` her zaman valide edilir:
  `core/http/pipes` içinden `@Param('id', ParseUuid)` (hazır `ParseUUIDPipe` kod değil düz metin
  fırlatıyor).

## Response şekli

Başarı (interceptor kurar, elle asla kurulmaz):

```json
{ "success": true, "message": "…", "data": {}, "meta": {}, "timestamp": "…" }
```

Hata (`AllExceptionsFilter` kurar): `error` client'ın switch'lediği stabil bir KOD, `details`
alan bazlı validasyon mesajlarını taşır. **500 mesajını asla sızdırmaz** — sebep sadece loga
gider.

## Veritabanı

- Tablolar `core/db/schema/<tablo-adi>.ts` içinde, dosya başına bir tablo; hepsi
  `schema/index.ts`'ten yeniden export edilir (drizzle-kit'in giriş noktası).
- **SQL elle yazılmaz:** şemayı düzenle → `pnpm --filter api db:generate` → üretilen SQL'i oku →
  `db:migrate`. Migration'lar sıralıdır, atlanmaz, geri alınmaz; geri dönüş yeni bir
  migration'la olur.
- Servisler `@Inject(DRIZZLE) private readonly db: Database` ile enjekte eder.
- Silmek yerine pasifleştir (`is_active`).

## Pazarlığa kapalı olanlar

- Her public (kimliksiz) endpoint kendi `@Throttle`'ını taşımak, katı valide edilmek ve
  ihtiyacından fazla alan döndürmemek zorundadır.
- Sahiplik her sorgunun parçasıdır — bir satıra sadece id ile ulaşılamaz. Başkasının satırı 403
  değil 404 döner (var olduğunu sızdırma).
- Refresh token deseni bozulmaz: rotation + reuse detection + family revoke. Refresh
  endpoint'inde cache ve otomatik retry yok.
- Auth cookie'leri `httpOnly` + `sameSite: 'lax'` kalır, production'da `secure` olur ve refresh
  cookie'si `/api/v1/auth` path'ine kısıtlı kalır. Token'lar response body'sinde asla görünmez.
- `ValidationPipe` `whitelist: true` ile çalışır — kapatma; bir client'ın body'ye
  `role: "admin"` sızdırmasını engelleyen şey budur.
- Para ve diğer kritik aritmetik sadece sunucuda, transaction içinde yapılır; client'ın
  hesapladığı değere asla güvenilmez.
- Diske dokunan tek sınıf `core/storage/storage.service.ts`'tir. `/api/uploads/*` yolu `/api/v1`
  prefix'inin dışında kalır — o URL'ler veritabanında duruyor.
- Tek API instance varsayılır (WS state bellekte) — yatay ölçekleme önce Redis pub/sub demektir.
- `NODE_ENV=production` iken Swagger kapalı kalır.

## Geliştirme

Claude Code kendi başına dev sunucusu başlatmaz — `pnpm dev`'i kullanıcı kendi terminalinde
çalıştırır. Bir şeyi doğrulamak gerçekten çalışan bir sunucu gerektiriyorsa önce portu kontrol
et (`lsof -nP -iTCP:3000 -sTCP:LISTEN`), dinleyen bir şey yoksa kullanıcıya sor.

Geliştirme için Postgres `docker compose -f docker-compose.dev.yml up -d` ile gelir; lokalde
Docker'da başka hiçbir şey çalışmaz.
