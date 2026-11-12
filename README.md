# Pocket: layout Herdr theo kiểu game bắt quái Game Boy

Layout cho ứng dụng desktop **Herdr** (`herdr-app`): mỗi agent (Claude Code, Codex,
OpenCode, Antigravity, Gemini…) là một Pokémon Gen 1 trong đội hình của bạn. Giao diện
mô phỏng menu Gen 2 với bảng màu Catppuccin Macchiato. Hỗ trợ **tiếng Việt** và **tiếng Anh**
(đổi ngay trong **MENU**).

> **Repo này không chứa hình Pokémon nào.** Chỉ có mã và cách làm. Hình được tải về
> máy bạn ở lần dùng đầu tiên từ các kho sprite công khai (xem *Hình ảnh lấy từ đâu*).
> Pokémon và các tên liên quan là thương hiệu của Nintendo / Game Freak / The Pokémon
> Company. Đây là dự án cá nhân, phi thương mại, không liên kết với các công ty đó.
> Đừng đăng lên chợ mod của Herdr kèm hình Pokémon.

## Cài đặt

Cần: `herdr-app`, `python3`, và Pillow (`pip install pillow`, nên có: dùng để phóng
hình 2x và làm GIF dáng đi; thiếu thì hình chỉ ở cỡ 1x).

```sh
git clone https://github.com/tecix/herdr-pokemon-silver && cd herdr-pokemon-silver
./install.sh                                   # symlink vào ~/.config/herdr-app ($HERDR_APP_HOME)
herdr-app do layout.switch --name pocket
```

Mặc định `install.sh` **tạo symlink** `mods/pocket`, `layouts/pocket.*`, `themes/pocket.json`, `themes/pocket-light.json`
từ app về repo này, nên sửa code hay `git pull` ở đây là Herdr chạy bản mới. Herdr không
thấy thay đổi nằm sau symlink, vì vậy script cài thêm một watcher nhỏ (`tools/watch.py`,
systemd user service `herdr-pocket-watch`): file trong repo đổi thì nó thay lại symlink và
Herdr nạp lại. Không có systemd thì tự chạy `python3 tools/watch.py &` khi đang sửa, hoặc
`python3 tools/watch.py --once` sau mỗi lần sửa. Herdr không nạp hình và âm thanh nằm sau
symlink, nên `glyphs/`, `sprites/`, `sounds/` được **chép** sang `data/pocket/ui/` (watcher chép
lại khi chúng đổi) và Poké Ball được vẽ ở đó. `./install.sh --copy` chép như cũ (chạy lại
để cập nhật). Bản cài kiểu chép trước đó được chuyển sang một thư mục tạm, không bị xóa.
Pokémon đã chọn, EXP và hình đã tải (shared state của Herdr và `data/pocket/`) được giữ nguyên.

Tùy chọn:
- **Tên session, trạng thái, model của Claude Code** chạy dạng background (`claude attach`)
  được đọc từ `~/.claude/sessions` (`agent-info.py`), vì kiểu chạy đó không báo trạng thái cho Herdr.
- **Thanh HP** và bảng giới hạn trong thông tin agent dùng các file cache giới hạn mà layout *Over9k* ghi (status line Claude
  → `~/.cache/over9k/usage/claude.json`, `antigravity.json`) và `mods/over9k-usage/opencode-quota.py`
  cho OpenCode. Không có thì thanh HP để trống và mờ (không đoán).

## Có gì trên màn hình

| Vùng | Role | Nội dung |
|---|---|---|
| Thanh trên | `bar` | Icon hệ của đảo + tên space như địa danh, các tab, đảo (icon hệ + tên máy), đồng hồ kiểu Gen 2, **THƯ** (thông báo, có số chưa đọc), **MENU** |
| Sidebar trái | `party` | **ĐỘI HÌNH**: tối đa 6 agent; **HỘP PC** cho phần còn lại; **BẢN ĐỒ** gồm các space |
| Tiêu đề mỗi pane | `header` | Icon Pokémon, tên agent, model đầy đủ, HP, trạng thái. **Chuột phải để đổi tên pane** |
| Dải dưới trái | `field` | Pokémon đi lại khi làm việc, đi dạo khi rảnh, ngủ sau 3 phút |
| Hộp thoại dưới phải | `dialog` | Thông báo mới nhất, gõ từng chữ. Agent chờ bạn trả lời → màn **chạm trán** (TRẢ LỜI / CHẠY) |
| Overlay | `menu`, `trainer`, `map`, `picker`, `rename`, `inbox`, `agent`, `fight` | Menu START, thẻ trainer, bản đồ, chọn Pokémon, đặt tên pane, danh sách thông báo, thông tin agent, chiêu thức |

Thẻ agent trong đội hình gồm: icon Pokémon (nhảy khi làm việc, run khi chờ, mờ khi ngủ),
tên agent, tên space, model rút gọn kèm vạch effort, thanh **HP** và thanh **EXP**.

- **HP** = phần trăm **còn lại** của giới hạn 5 giờ của sản phẩm đó trên máy chạy agent
  (100 − % đã dùng). Lấy cửa sổ hiện tại và mức dùng cao nhất từng thấy trong cửa sổ đó,
  vì một session Claude đang rảnh có thể ghi lại số cũ thấp hơn vào cache dùng chung.
  Cửa sổ đã reset thì HP đầy lại.
- **EXP**: mỗi việc xong (`done`) được +34. Đầy thanh (3 việc) thì Pokémon **tiến hóa**
  theo dòng Gen 1, hết đường tiến hóa thì thành **shiny**. Mỗi lần như vậy được một huy hiệu.
- **Tên agent**: tên đặt cho pane > tên tab đã đặt > tên session Claude > tiêu đề pane > tên chương trình.
- **Chuột phải** vào thẻ trong đội hình (hoặc dòng trong HỘP PC) để mở **thông tin agent**:
  chương trình, model + effort, trạng thái, space/tab, thư mục + nhánh git, máy, terminal,
  session Claude, EXP, và **giới hạn dùng** của sản phẩm đó trên máy đó: mọi cửa sổ đã biết
  (5 giờ, 7 ngày, theo model, tháng…) với phần còn lại, giờ reset và thời gian còn lại; gói và
  tài khoản nếu panel máy của Over9k biết. Chuột phải vào **icon Pokémon** trên thẻ để đổi
  Pokémon. Chuột phải vào tiêu đề pane để đổi tên pane.
- **Chiêu thức**: chuột phải vào một Pokémon trên **cánh đồng** để mở bảng chiêu kiểu Gen 2
  (↑↓/Enter, hoặc bấm). Mỗi Pokémon có 4 chiêu theo hệ Gen 1 của nó (vài con có chiêu riêng:
  Magikarp SPLASH, Ditto TRANSFORM, Snorlax REST…). Số chiêu dùng được = 1 + bậc tiến hóa
  (0/1/2) + 1 nếu shiny, tối đa 4; chiêu chưa mở hiện mờ kèm điều kiện. Chọn chiêu thì Pokémon
  dừng lại và ra chiêu trên cánh đồng: hiệu ứng theo hệ (lửa, nước, điện, siêu linh, đá…),
  chiêu càng mạnh càng nhiều hạt, xa và lâu hơn; chiêu mạnh nhất làm lóe cả cánh đồng.
- **Thị trấn mới**: bấm **+ THỊ TRẤN MỚI** cuối **BẢN ĐỒ** ở sidebar, chọn đảo (MÁY NÀY
  hoặc một máy trong `hc machine ls`) là có space mới ở đó; chỉ có máy này thì tạo luôn.
  Overlay bản đồ vẽ đủ mọi máy thành đảo, kể cả đảo chưa có thị trấn; mỗi đảo có dòng
  **+ THỊ TRẤN MỚI** riêng, phím **N** tạo trên đảo của thị trấn đang chọn.
- **Hệ của đảo**: mỗi đảo (máy) có một hệ Pokémon (18 hệ). Icon hệ đứng trước tên thị trấn
  ở **BẢN ĐỒ** (sidebar và overlay), trong HỘP PC, thẻ thị
  trấn và tiêu đề trên thanh trên cùng; bên phải thanh trên là icon hệ + tên máy của thị
  trấn đang xem (chỗ huy hiệu cũ; huy hiệu vẫn ở **THẺ TRAINER**). Đảo mới tự nhận một hệ
  theo tên máy, không trùng đảo khác khi còn hệ trống. Đổi hệ trong overlay bản đồ: bấm ô hệ
  ở đầu đảo, hoặc phím **T** (Shift+T lùi lại).
- Pane terminal thường (shell) có **Poké Ball** làm icon trên tiêu đề.
- **THƯ / MENU › THÔNG BÁO**: danh sách thông báo, lọc TẤT CẢ / CHƯA ĐỌC, ✓ để đánh dấu
  đã đọc hoặc chưa đọc từng cái, **ĐỌC HẾT**, **XÓA ĐÃ ĐỌC**. Bấm một dòng để tới agent đó.
- **GHI CHÚ / NOTES** (nút trên thanh trên cùng, hoặc **Alt+N** ở bất cứ đâu trong layout): mở khung
  **Neovim** bên phải trên `~/.config/herdr-app/data/pocket/notes.md` và đặt con trỏ vào đó; đang gõ trong
  đó thì Alt+N ẩn nó và quay lại pane cũ. Neovim chạy với `clipboard=unnamed,unnamedplus`, tự lưu mỗi lần
  sửa, tự đọc lại khi file đổi bên ngoài; vẫn chạy khi khung ẩn, `:q` thì lần mở sau tự chạy lại (terminal
  core tên `pocket-notes`). Đóng cửa sổ `herdr-app` (hoặc app bị crash) thì Neovim tự lưu và thoát sau
  khoảng 10 giây (cần `pgrep`), lần mở app sau khung ghi chú chạy lại nó. Muốn ghi vào file khác trên một máy: thay `notes.md` bằng symlink tới file đó, Neovim
  sẽ mở file đích và chạy trong thư mục của nó. Phím nằm trong `keys.json`: `"layout:pocket": { "alt-n": "pocket.notes" }`.
- **MENU › NGÔN NGỮ / LANGUAGE**: đổi qua lại giữa tiếng Việt (`VI`) và tiếng Anh (`EN`).

## Hình ảnh lấy từ đâu (cách làm)

`mons.js` tải hình **khi cần**, vào `~/.config/herdr-app/data/pocket/<số dex>[s]/`:

1. **Sprite mặt trước + động Gen 3 (Emerald)** và **icon menu 40×30 (gen VII)** từ
   [PokeAPI/sprites](https://github.com/PokeAPI/sprites): `sprites/pokemon/versions/generation-iii/emerald/…`,
   `…/generation-vii/icons/…`. Bản shiny: thư mục `shiny/` (PokeAPI), form `0000/0001` (SpriteCollab).
2. **Bộ dáng đi** (walk/idle/sleep) từ [PMDCollab/SpriteCollab](https://github.com/PMDCollab/SpriteCollab)
   (`sprite/<dex>/`: `AnimData.xml` + các sheet). `pmd.py` cắt sheet thành GIF từng hướng.
3. `pixel.py` phóng 2x theo kiểu nearest-neighbour để hình sắc nét. `bbox.py` đo vùng
   pixel thật để canh giữa.
4. Kết quả được ghi trong shared state `pocket.art` / `pocket.walk`. Lỗi mạng thì thử lại sau 1 phút.
5. **Icon hệ** của đảo: `types.js` tải tấm
   [Pokemon icons của JWNutz](https://www.deviantart.com/jwnutz/art/Pokemon-icons-669595851) (DeviantArt)
   vào `data/pocket/types/sheet.png`, rồi `typecut.py` (cần Pillow) cắt 18 icon hệ ra
   `data/pocket/types/<hệ>.png` (64px) và `<hệ>2.png` (128px). Chưa có thì mỗi hệ là một ô vuông màu của nó;
   lỗi thì thử lại sau 30 phút.

Mỗi pane được gán một số dex (băm từ id pane, không trùng nhau trên màn hình), lưu ở
`pocket.mons`. Danh sách 151 tên ở `names.js`.

Những thứ **có** trong repo đều là đồ tự làm: sprite pixel 16×16 cho từng chương trình
(`sprites/`, dùng cho pane shell), các glyph (`glyphs/`), hai đoạn nhạc chiptune gốc
(`sounds/`, tạo bằng `chiptune.py`), font Galmuri (SIL OFL, `fonts/OFL-Galmuri.txt`).
Quả bóng hiện khi đang tải hình được vẽ lúc cài (`tools/make-pokeball.py`).

## Cấu trúc mã

```
layouts/pocket.json   cây layout: bar / [party | tabs] / [field | dialog]
layouts/pocket.svg    hình xem trước trong bộ chọn layout (preview.py vẽ)
themes/pocket.json    Catppuccin Macchiato (tối)
themes/pocket-light.json  Rosé Pine Dawn (sáng): layout theo chế độ sáng/tối của hệ thống
mods/pocket/
  main.js     chọn role theo props.role (không có role: vẽ mọi role, cho herdr-app check)
  kit.js      bảng màu, font pixel theo zoom, frame, thanh HP/EXP, tên agent, mood,
              EXP/tiến hóa, sự kiện + đã đọc, mở overlay
  mons.js     Pokémon của từng pane, tải hình, danh sách agent, bộ nạp chạy nền
              (thông tin Claude, model đọc từ màn hình, mức dùng 5 giờ)
  bar.js party.js header.js field.js dialog.js            các vùng cố định
  menu.js trainer.js map.js picker.js rename.js inbox.js   các overlay
  agent.js       overlay thông tin agent + giới hạn dùng
  fight.js       popup chiêu thức (từ cánh đồng)
  notes.js       đầu khung ghi chú (cột "notes" của layout, Alt+N); Neovim chạy trong block terminal bên dưới
  moves.js       hệ Gen 1 của 151 con, bộ chiêu, số chiêu mở theo tiến hóa
  types.js       hệ của từng đảo (máy), icon hệ (tải + cắt bằng typecut.py)
  fx.js          hiệu ứng của từng hệ trên cánh đồng (chỉ animation native)
  agent-info.py  session Claude Code → pocket.info
  usage5h.py     mức dùng của máy theo từng cửa sổ (5h, 7d…; chạy cả trên máy remote qua exec {on})
  pixel.py pmd.py bbox.py typecut.py chiptune.py preview.py   công cụ
tools/make-pokeball.py  vẽ glyph quả bóng lúc cài
tools/watch.py          thay lại symlink khi file trong repo đổi, để Herdr nạp lại
```

Shared state (`~/.config/herdr-app/shared.json`): `pocket.mons`, `pocket.shiny`, `pocket.art`,
`pocket.walk`, `pocket.levels`, `pocket.badges`, `pocket.events` (tối đa 50, có cờ `read`),
`pocket.info`, `pocket.screen`, `pocket.hp` (kèm `windows` cho mọi cửa sổ giới hạn),
`pocket.names`, `pocket.trainer`, `pocket.fx` (chiêu vừa ra), `pocket.lang` (`"vi"` | `"en"`), `pocket.notes.back` (pane để quay lại sau Alt+N),
`pocket.islands` (hệ của từng đảo, `""` = máy này), `pocket.types.icons` (`"ready"` | `"error"`), `pocket.host` (tên máy này).

### Ghi chú khi sửa
- Chỉ một bản sao chạy bộ nạp: role `dialog` gọi `startLoader(cx)` trong `init`.
- Font pixel chỉ nét ở bội số nguyên của lưới theo pixel màn hình. `kit.syncZoom()` tính lại
  cỡ chữ theo zoom trong settings. Hình dùng `crisp()` vì cùng lý do.
- `on_size_change` trả về px đã nhân zoom, nên chia cho `zoom()`.
- Kiểm tra: `herdr-app check ~/.config/herdr-app/mods/pocket`, rồi `herdr-app shot x.png`.
  Khi cửa sổ ở nền, `shot` có thể trả khung hình cũ: chụp lại tới khi ảnh đổi.
- Thử trạng thái blocked mà không cần agent thật: trong một tab, in
  `printf '\033]7501;state=blocked:kind=question:app=pocket-test\a'`.

## Ghi công
- Dải `field` và danh sách tên được port từ
  [mathieucroset/herdr-pokemon-agents](https://github.com/mathieucroset/herdr-pokemon-agents) (MIT).
- Font [Galmuri](https://github.com/quiple/galmuri) của Minseo Lee (SIL Open Font License 1.1).
- Hình Pokémon (tải lúc chạy, không phân phối ở đây): PokeAPI/sprites, PMDCollab/SpriteCollab.
- Icon hệ (tải lúc chạy, không phân phối ở đây): [Pokemon icons](https://www.deviantart.com/jwnutz/art/Pokemon-icons-669595851) của JWNutz.
