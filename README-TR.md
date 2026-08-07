# nest-drizzle-starter

> 🇬🇧 English: [README.md](README.md)

NestJS + TypeScript + Drizzle (PostgreSQL) API iskeleti. pnpm monorepo: `apps/api` çalışmaya
hazır, `apps/web` boş — frontend framework'ünü proje başlarken sen seçiyorsun.

Kutudan çıkanlar: cookie tabanlı JWT auth (access + refresh, rotation ve çalınma tespitiyle),
rol guard'ları, Swagger dokümantasyonu, görsel yükleme (sharp ile WebP'ye yeniden kodlama),
cookie ile kimlik doğrulayan WebSocket gateway, günlük döndürülen dosya logları, geliştirme için
sadece Postgres içeren bir compose dosyası ve production için Traefik etiketli bir tane.

## Hızlı başlangıç

```bash
cp .env.example .env                              # JWT secret'larını değiştir
pnpm install
docker compose -f docker-compose.dev.yml up -d    # sadece postgres
pnpm --filter shared build                        # api, shared'ın dist'ine karşı derleniyor
pnpm --filter api db:migrate
pnpm dev                                          # api :3000'de
```

İlk kullanıcıyı oluştur:

```bash
pnpm --filter api user:create admin@example.com secret123 "Admin" admin
```

Kontrol et:

```bash
curl localhost:3000/api/v1/health
curl -c cookies.txt -X POST localhost:3000/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@example.com","password":"secret123"}'
curl -b cookies.txt localhost:3000/api/v1/auth/me
```

Etkileşimli API dokümantasyonu: <http://localhost:3000/api/docs> (sadece development).

## Komutlar

| Komut                                                      | Nerede | Ne yapar                                          |
| ---------------------------------------------------------- | ------ | ------------------------------------------------- |
| `pnpm dev`                                                 | kök    | `dev` script'i olan her paketi paralel çalıştırır |
| `pnpm build` / `pnpm check` / `pnpm lint`                  | kök    | her paketi derler / tip kontrolü / lint           |
| `pnpm --filter api db:generate`                            | api    | şemadan migration üretir                          |
| `pnpm --filter api db:migrate`                             | api    | bekleyen migration'ları uygular                   |
| `pnpm --filter api db:studio`                              | api    | Drizzle Studio'yu açar                            |
| `pnpm --filter api user:create <email> <şifre> <ad> [rol]` | api    | kullanıcı oluşturur                               |

## Yerleşim

```
apps/api/src/
├─ main.ts           bootstrap: pipe, filter, interceptor, cors, cookie, swagger, ws adapter
├─ app.module.ts     TÜM modüller tek dosyada — NestJS'te router'ın karşılığı
├─ core/             MODÜLE ÖZGÜ HİÇBİR ŞEY BURADA DURMAZ
│  ├─ config/        env.validation.ts (Joi — hatalı deploy açılışta patlar), winston.config.ts
│  ├─ db/            drizzle.module.ts (DRIZZLE token'ı), schema/, migrations/, migrate.ts
│  ├─ health/        gerçekten veritabanına giden sağlık kontrolü
│  ├─ http/          decorator, dto, filter, guard, interceptor, middleware, pipe, type
│  ├─ realtime/      WebSocket gateway
│  ├─ security/      token.service.ts — JWT imzalama/doğrulama
│  ├─ storage/       diske dokunan TEK sınıf
│  └─ utils/         password, duration
└─ modules/          ürün kodu: auth/ example/ uploads/
packages/shared/src/ sabitler + tipler + api-client — frontend ile paylaşılan sözleşme
```

### İki kural (bozma)

1. **Modüller birbirine sadece `index.ts` üzerinden ulaşır.** `modules/x/` içinden
   `modules/y/y.service` import edilmez, `modules/y` import edilir.
2. **`core` hiçbir modüle bağlı değildir.** core'daki bir dosyanın modüle ihtiyacı varsa tasarım
   yanlıştır (token imzalamak core'un, login endpoint'i modülün işidir).

### Modül iskeleti

```
modules/<ad>/
├─ <ad>.service.ts             DB ile konuşan TEK katman
├─ <ad>.controller.ts          HTTP yüzeyi: içeri DTO, dışarı ServiceResponse
├─ public-<ad>.controller.ts   (opsiyonel) aynı modülün kimliksiz yüzeyi
├─ dto/                        class-validator + @ApiProperty — Swagger bunlardan üretiliyor
├─ <ad>.module.ts              bağlantılar
└─ index.ts                    modülün public API'si
```

Yeni modül = `modules/example/`'ı kopyala, `app.module.ts`'e bir import ve bir satır ekle.

## Response şekli

Her başarılı yanıt aynı zarfla çıkar; zarfı `ResponseTransformInterceptor` ekler — controller
sadece `{ message, data?, meta? }` döndürür:

```json
{ "success": true, "message": "Signed in", "data": {}, "timestamp": "2026-08-07T07:48:29.362Z" }
```

Hatalar bunun yerine `AllExceptionsFilter`'dan geçer. `error`, client'ın switch'lediği ve
çevirdiği stabil bir KOD'dur; serbest metin `details`'a gider:

```json
{ "success": false, "error": "invalid_credentials", "statusCode": 401, "timestamp": "…" }
{ "success": false, "error": "validation_error", "statusCode": 400,
  "details": ["email must be an email"], "timestamp": "…" }
```

500 mesajını asla sızdırmaz — gerçek sebep aynı timestamp ile loga düşer.

## Veritabanı

Tablolar `apps/api/src/core/db/schema/` altında, dosya başına bir tablo; `index.ts` hepsini
yeniden export eder ve `drizzle.config.ts`'in giriş noktasıdır — bu barrel'da olmayan bir tablo
`db:generate` açısından yok demektir.

SQL asla elle yazılmaz:

```bash
# 1. schema/<tablo>.ts yaz ya da düzenle, index.ts'e ekle
pnpm --filter api db:generate    # 2. SQL + meta snapshot üretilir
pnpm --filter api db:migrate     # 3. uygulanır
```

Migration'lar sıralıdır, atlanmaz ve geri alınmaz — geri dönüş yeni bir migration'la olur.
Uygulamadan önce üretilen `.sql`'i oku: Drizzle bir kolon yeniden adlandırmasını bazen "drop +
add" olarak çözer, bu da veri kaybıdır.

Servisler client'ı `@Inject(DRIZZLE) private readonly db: Database` ile enjekte eder.

Silmek yerine pasifleştirmeyi (`is_active`) tercih et; böylece geçmiş ve o satıra referans veren
kayıtlar hayatta kalır.

## Auth

Tek kullanıcı evreni (`users` tablosu), yetki `role` ile ayrılıyor. **Token'lar response
body'sinde asla yok** — tarayıcının okuyamadığı httpOnly cookie'lerdeler, yani bir XSS açığı
oturumu alıp götüremez. Access token 15 dakika, refresh token 30 gün yaşar ve **veritabanında
takip edilir**:

- Her refresh rotate eder: eski satır `used_at` ile yakılır, yeni satır açılır.
- Harcandıktan sonra geri gelen bir token çalınmış sayılır ve `family_id`'sindeki bütün
  token'lar iptal edilir. 10 saniyelik grace penceresi, yarışların (kopan bağlantı, ikinci
  sekme) hırsızlık sanılmasını engeller.
- Logout bütün aileyi iptal eder; şifre değişimi kullanıcının TÜM token'larını iptal eder ama
  isteği yapan sekmeye taze bir çift verir.

Bu deseni bozma: refresh endpoint'ini cache'lemek ya da otomatik retry'a bağlamak reuse
detection'ı yanlış sebeple tetikler.

Endpoint'ler: `POST /api/v1/auth/{register,login,refresh,logout}`,
`GET|PATCH /api/v1/auth/me`. Açık kayıt istemiyorsan `auth.controller.ts`'ten `register`
handler'ını sil ve kullanıcıları `user:create` ile ekle.

Bir route'u korumak:

```ts
@UseGuards(JwtGuard)                    // oturum gerekir
@UseGuards(JwtGuard, RolesGuard)        // …ve rol
@Roles('admin')
```

`@GetUser('id')` çağıranın id'sini, `@GetUser()` bütün `AuthContext`'i verir.

## Upload

`POST /api/v1/uploads/image` (oturum gerekir, multipart alan adı `file`) görseli sharp ile
WebP'ye çevirir, `<UPLOAD_DIR>/<userId>/` altına yazar ve public bir URL döner. Yeniden kodlama
EXIF'i (konum verisi!) siler ve byte'ların gerçekten bir görsel olduğunu garanti eder.

Diske dokunan tek sınıf `core/storage/storage.service.ts` — S3'e geçmek sadece o dosyayı
değiştirmek olmalı. Servis edilen URL (`/api/uploads/...`) bilerek `/api/v1` prefix'inin
DIŞINDA: o URL'ler veritabanında duruyor ve API sürümü değişince yerinden oynamamalı.

**Production'da `uploads` volume'ünü yedeklemek `pgdata` kadar önemli: o dosyalar veritabanı
dump'ında yok.**

## Realtime

`ws://…/ws` — ham `ws`, client kütüphanesi gerekmiyor. Tarayıcı auth cookie'sini handshake'te
kendisi gönderir, dolayısıyla join mesajı da query string'de token da yok. Kimliksiz socket 1008
koduyla kapatılır.

Herhangi bir servisten kullanıcıya push: `EventsGateway`'i enjekte et ve
`sendToUser(userId, type, data)` çağır. State bellekte, yani TEK API instance varsayılıyor —
ölçeklemek önce o metodun arkasına Redis pub/sub koymak demek.

## Loglar

Winston, `apps/api/logs/` altına günlük döndürerek yazar: `app-%DATE%.log` (info ve üstü) ve
`error-%DATE%.log`, 15 gün, gzip'li. Development'ta okunaklı bir console transport eklenir;
production'da stdout JSON kalır ki `docker logs` ve herhangi bir toplayıcı parse edebilsin.

`HttpLoggerMiddleware` başarılı istekleri loglar (3 saniyeyi geçeni `SLOW` diye işaretler);
`AllExceptionsFilter` hataları tam bağlamıyla loglar — böylece hiçbir şey iki kez yazılmaz.

## Frontend eklemek

`apps/web` boş. İçine bir framework kur, `package.json`'ına `"name": "web"` ve bir `dev`
script'i ver — kökteki `pnpm dev` (`pnpm --parallel -r dev`) onu kendiliğinden yakalar.

Örnek (React + Vite):

```bash
cd apps/web && pnpm create vite@latest . -- --template react-ts
pnpm add shared@workspace:*
```

`vite.config.ts`'e proxy ekle ki tarayıcı TEK origin görsün — o zaman auth cookie'leri hiçbir
CORS ayarı olmadan gider:

```ts
server: {
  proxy: {
    "/api": "http://localhost:3000",
    "/ws": { target: "ws://localhost:3000", ws: true }
  }
}
```

Sonra `shared`'daki client'ı kullan:

```ts
import { createApiClient } from "shared";

const api = createApiClient({ baseUrl: "", onSessionExpired: () => navigate("/login") });
await api.auth.login({ email, password }); // cookie'leri sunucu set ediyor
const { items, meta } = await api.examples.list({ page: 1 });
```

Client her çağrıda `credentials: "include"` gönderir ve bir istek 401 dönerse tek seferlik
(single-flight) refresh yapar — bu mantığı bir daha yazmıyorsun.

Frontend API'den farklı bir origin'de çalışıyorsa o origin'i `CORS_ORIGIN`'e yaz; tarayıcılar
credential'lı istekleri wildcard'a karşı reddeder, bu yüzden boş değer "sadece aynı origin"
demektir.

Birden fazla frontend gerekiyorsa (mesela `apps/admin`) aynı deseni kopyala: yeni klasör, farklı
port, `docker-compose.yml`'de yeni servis ve yeni Traefik router.

## Production deploy

`docker-compose.yml`, VPS'te zaten çalışan ve dışarıdaki `traefik-net` ağının sahibi olan bir
Traefik instance'ı varsayar — Traefik'i kendisi başlatmaz. Entrypoint `https`, cert resolver
`letsencrypt`; seninkiler farklı adlandırılmışsa etiketleri değiştir.

```bash
cp .env.example .env      # DOMAIN, DB_*, JWT_* → gerçek değerler
docker compose up -d --build
docker compose exec api node dist/core/db/migrate.js
```

Postgres yalnızca `internal` ağında; ne dış dünya ne de Traefik ona ulaşabilir. Yüklenen
dosyalar `uploads` volume'ünde kalıcıdır. `NODE_ENV=production` iken Swagger kapalıdır — şema
her endpoint'in ve her alan adının haritasıdır.

## AI araçlarıyla çalışmak (CLAUDE.md)

Repo kökündeki [CLAUDE.md](CLAUDE.md) bu iskeletin kurallarını — modül sınırları, response
zarfı, migration akışı, refresh token deseni — makine tarafından okunacak biçimde tutar.
[CLAUDE.TR.md](CLAUDE.TR.md) insan okuru için Türkçe çeviridir; araçlar `CLAUDE.md`'yi okur, o
yüzden kurallar değişince ikisini birden güncelle.

- **Claude Code kullanıyorsan?** Yapacak bir şey yok: dosya her oturumda otomatik yükleniyor.
- **Başka bir şey kullanıyorsan?** (Cursor, Copilot, Codex, Gemini…) Dosya kendiliğinden
  alınmaz. İçeriğini o aracın kendi kural dosyasına kopyala — `.cursor/rules/`,
  `.github/copilot-instructions.md`, `AGENTS.md`, `GEMINI.md`, neyse. `CLAUDE.md`'ye referans
  vermek yerine metni kopyala; çoğu araç sadece adını andığın bir dosyayı açmaz.
- **Hiç AI kullanmıyorsan?** Yine de oku: iskeletin neden böyle kurulduğunun en kısa açıklaması.

## Kendine göre uyarla

- [ ] Proje adını `package.json` ve `docker-compose.yml` içinde değiştir (`name: app`,
      `container_name: app_*`, `traefik.http.routers.app-*`)
- [ ] `.env`'e gerçek bir `DOMAIN` ve rastgele JWT secret'ları koy (`openssl rand -hex 32`)
- [ ] `modules/example/`, `schema/examples.ts`, `constants/example.ts`, `types/example.ts`,
      `api-client/example.service.ts` → sil ya da ilk gerçek modülüne dönüştür
- [ ] İhtiyacın yoksa `core/realtime/` (WebSocket) ya da `core/storage/` + `modules/uploads/`
      klasörlerini sil
- [ ] `apps/web`'e bir framework kur, compose dosyasındaki `web` servisini yorumdan çıkar
- [ ] `main.ts`'teki Swagger başlığını ve açıklamasını ayarla
- [ ] Claude Code dışında bir AI aracı kullanıyorsan `CLAUDE.md`'yi onun kural dosyasına kopyala
