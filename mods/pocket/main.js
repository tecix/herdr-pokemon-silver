// Pocket: a 4-shade handheld monster-RPG layout. One mod, in roles; the layout
// gives each copy props { role }:
//   bar     top strip: place name (the shown space), badges, clock, window buttons
//   party   left sidebar: agents as the party (up to 6), the PC box below
//   header  each pane's header: monster name, Lv, HP/EXP, status
//   dialog  bottom text box: the newest event, typed out; watches agents;
//           runs the Pokémon art loader (mons.js)
//   field   bottom strip: the Pokémon walk, rest and sleep (like
//           mathieucroset/herdr-pokemon-agents)
//   picker  dialog overlay: choose the Pokémon for a pane (kit openPicker)
//   menu    popup: the START menu (top bar MENU, kit openMenu)
//   trainer dialog: the trainer card (kit openTrainer)
//   map     dialog: the town map, spaces as towns (kit openMap)
//   rename  dialog: name a pane (kit openRename; right-click its header)
//   inbox   dialog: the notifications, mark read / all read (kit openInbox)
//   agent   dialog: one agent's details and usage limits (kit openAgentInfo;
//           right-click a party card, not its icon)
//   town    dialog: one town's details (kit openTown; right-click a town row or map town)
//   quest   dialog: each town's to-do list (the `todo` command) as quests (kit openQuest)
//   bag     popup: items that send a preset command to one agent (kit openBag)
//   fight   popup: a Pokémon's moves (kit openFight; right-click it on the
//           field); the field plays the one picked (moves.js, fx.js)
// With no role (herdr-app check), every role renders once, stacked, so a check
// covers them all.

import { View, div } from "gpui-kit";
import { props } from "herdr";
import Bar from "./bar.js";
import Party from "./party.js";
import Header from "./header.js";
import Dialog from "./dialog.js";
import Picker from "./picker.js";
import Field from "./field.js";
import Menu from "./menu.js";
import Trainer from "./trainer.js";
import TownMap from "./map.js";
import Rename from "./rename.js";
import Inbox from "./inbox.js";
import AgentInfo from "./agent.js";
import Fight from "./fight.js";
import Stamina from "./stamina.js";
import Quest from "./quest.js";
import Bag from "./bag.js";
import Town from "./town.js";
import { syncZoom, syncTheme } from "./kit.js";

const ROLES = { bar: Bar, party: Party, header: Header, dialog: Dialog, picker: Picker, field: Field, menu: Menu, trainer: Trainer, map: TownMap, rename: Rename, inbox: Inbox, agent: AgentInfo, fight: Fight, stamina: Stamina, quest: Quest, bag: Bag, town: Town };

export default class Pocket extends View {
  init(p, cx) {
    const pr = props() ?? p ?? {};
    const names = pr.role ? [pr.role] : Object.keys(ROLES);
    this.roles = names.filter((n) => ROLES[n]).map((n) => {
      const r = new ROLES[n]();
      r.init?.(pr, cx);
      return r;
    });
    this.missing = pr.role && !ROLES[pr.role] ? pr.role : null;
  }

  render(cx) {
    syncZoom(); // pixel font sizes follow settings zoom
    syncTheme(); // the palette follows the shown theme (light/dark)
    if (this.missing) return div().child(`pocket: no role "${this.missing}"`);
    if (this.roles.length === 1) return this.roles[0].render(cx);
    return div().flex().flex_col().children(this.roles.map((r) => r.render(cx)));
  }
}
