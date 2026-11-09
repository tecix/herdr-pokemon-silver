# Pocket: layout Herdr theo kiểu game bắt quái Game Boy

Layout cho ứng dụng desktop **Herdr** (`herdr-app`): mỗi agent (Claude Code, Codex,
OpenCode, Antigravity, Gemini…) là một Pokémon Gen 1 trong đội hình của bạn. Giao diện
mô phỏng menu Gen 2 với bảng màu Catppuccin Macchiato. Chữ hiển thị bằng tiếng Việt.

> **Repo này không chứa hình Pokémon nào.** Chỉ có mã và cách làm. Hình được tải về
> máy bạn ở lần dùng đầu tiên từ các kho sprite công khai (xem *Hình ảnh lấy từ đâu*).
> Pokémon và các tên liên quan là thương hiệu của Nintendo / Game Freak / The Pokémon
> Company. Đây là dự án cá nhân, phi thương mại, không liên kết với các công ty đó.
> Đừng đăng lên chợ mod của Herdr kèm hình Pokémon.

## Cài đặt

Cần: `herdr-app`, `python3`, và Pillow (`pip install pillow`, nên có: dùng để phóng
hình 2x và làm GIF dáng đi; thiếu thì hình chỉ ở cỡ 1x).

```sh
git clone <repo> herdr-pocket && cd herdr-pocket
./install.sh                                   # chép vào ~/.config/herdr-app ($HERDR_APP_HOME)
herdr-app do layout.switch --name pocket
```

Chạy lại `./install.sh` để cập nhật. Pokémon đã chọn, EXP và hình đã tải (shared state
của Herdr và `data/pocket/`) được giữ nguyên.

Tùy chọn:
- **Tên session, trạng thái, model của Claude Code** chạy dạng background (`claude attach`)
  được đọc từ `~/.claude/sessions` (`agent-info.py`), vì kiểu chạy đó không báo trạng thái cho Herdr.
- **Thanh HP** dùng các file cache giới hạn 5 giờ mà layout *Over9k* ghi (status line Claude
  → `~/.cache/over9k/usage/claude.json`, `antigravity.json`) và `mods/over9k-usage/opencode-quota.py`
  cho OpenCode. Không có thì thanh HP để trống và mờ (không đoán).

## Có gì trên màn hình

| Vùng | Role | Nội dung |
|---|---|---|
| Thanh trên | `bar` | Tên space như địa danh, các tab, huy hiệu, đồng hồ kiểu Gen 2, **THƯ** (thông báo, có số chưa đọc), **MENU** |
| Sidebar trái | `party` | **ĐỘI HÌNH**: tối đa 6 agent; **HỘP PC** cho phần còn lại; **BẢN ĐỒ** gồm các space |
| Tiêu đề mỗi pane | `header` | Icon Pokémon, tên agent, model đầy đủ, HP, trạng thái. **Chuột phải để đổi tên pane** |
| Dải dưới trái | `field` | Pokémon đi lại khi làm việc, đi dạo khi rảnh, ngủ sau 3 phút |
| Hộp thoại dưới phải | `dialog` | Thông báo mới nhất, gõ từng chữ. Agent chờ bạn trả lời → màn **chạm trán** (TRẢ LỜI / CHẠY) |
| Overlay | `menu`, `trainer`, `map`, `picker`, `rename`, `inbox` | Menu START, thẻ trainer, bản đồ, chọn Pokémon, đặt tên pane, danh sách thông báo |

Thẻ agent trong đội hình gồm: icon Pokémon (nhảy khi làm việc, run khi chờ, mờ khi ngủ),
tên agent, tên space, model rút gọn kèm vạch effort, thanh **HP** và thanh **EXP**.

- **HP** = phần trăm **còn lại** của giới hạn 5 giờ của sản phẩm đó trên máy chạy agent
  (100 − % đã dùng). Lấy cửa sổ hiện tại và mức dùng cao nhất từng thấy trong cửa sổ đó,
  vì một session Claude đang rảnh có thể ghi lại số cũ thấp hơn vào cache dùng chung.
  Cửa sổ đã reset thì HP đầy lại.
- **EXP**: mỗi việc xong (`done`) được +34. Đầy thanh (3 việc) thì Pokémon **tiến hóa**
  theo dòng Gen 1, hết đường tiến hóa thì thành **shiny**. Mỗi lần như vậy được một huy hiệu.
- **Tên agent**: tên đặt cho pane > tên tab đã đặt > tên session Claude > tiêu đề pane > tên chương trình.
- **Chuột phải** vào thẻ trong đội hình để đổi Pokémon. Chuột phải vào tiêu đề pane để đổi tên pane.
- **THƯ / MENU › THÔNG BÁO**: danh sách thông báo, lọc TẤT CẢ / CHƯA ĐỌC, ✓ để đánh dấu
  đã đọc hoặc chưa đọc từng cái, **ĐỌC HẾT**, **XÓA ĐÃ ĐỌC**. Bấm một dòng để tới agent đó.

## Hình ảnh lấy từ đâu (cách làm)

`mons.js` tải hình **khi cần**, vào `~/.config/herdr-app/data/pocket/<số dex>[s]/`:

1. **Sprite mặt trước + động (Crystal)** và **icon menu 40×30 (gen VII)** từ
   [PokeAPI/sprites](https://github.com/PokeAPI/sprites): `sprites/pokemon/versions/generation-ii/crystal/…`,
   `…/generation-vii/icons/…`. Bản shiny: thư mục `shiny/` (PokeAPI), form `0000/0001` (SpriteCollab).
2. **Bộ dáng đi** (walk/idle/sleep) từ [PMDCollab/SpriteCollab](https://github.com/PMDCollab/SpriteCollab)
   (`sprite/<dex>/`: `AnimData.xml` + các sheet). `pmd.py` cắt sheet thành GIF từng hướng.
3. `pixel.py` phóng 2x theo kiểu nearest-neighbour để hình sắc nét. `bbox.py` đo vùng
   pixel thật để canh giữa.
4. Kết quả được ghi trong shared state `pocket.art` / `pocket.walk`. Lỗi mạng thì thử lại sau 1 phút.

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
themes/pocket.json    Catppuccin Macchiato
mods/pocket/
  main.js     chọn role theo props.role (không có role: vẽ mọi role, cho herdr-app check)
  kit.js      bảng màu, font pixel theo zoom, frame, thanh HP/EXP, tên agent, mood,
              EXP/tiến hóa, sự kiện + đã đọc, mở overlay
  mons.js     Pokémon của từng pane, tải hình, danh sách agent, bộ nạp chạy nền
              (thông tin Claude, model đọc từ màn hình, mức dùng 5 giờ)
  bar.js party.js header.js field.js dialog.js            các vùng cố định
  menu.js trainer.js map.js picker.js rename.js inbox.js   các overlay
  agent-info.py  session Claude Code → pocket.info
  usage5h.py     mức dùng 5 giờ của máy (chạy cả trên máy remote qua exec {on})
  pixel.py pmd.py bbox.py chiptune.py preview.py           công cụ
tools/make-pokeball.py  vẽ glyph quả bóng lúc cài
```

Shared state (`~/.config/herdr-app/shared.json`): `pocket.mons`, `pocket.shiny`, `pocket.art`,
`pocket.walk`, `pocket.levels`, `pocket.badges`, `pocket.events` (tối đa 50, có cờ `read`),
`pocket.info`, `pocket.screen`, `pocket.hp`, `pocket.names`, `pocket.trainer`.

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
