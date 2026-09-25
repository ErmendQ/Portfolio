/* Portfolio content, shared by index-v2.html and index-v3.html.

   Copy is written once, in English. Hungarian lives in SITE.hu, keyed by the
   English string; a missing key just shows the English text.

   Media are bare file names from assets/. The pages load the web copies that
   tools/optimize-media.py builds into assets/web/, so after adding a file:
       py tools/optimize-media.py
   Projects without a cover show as locked "upload in progress" slots.
   Display order follows `slot`. */
window.SITE = {
  email: 'erikthom.dev@proton.me',
  feedbackEndpoint: 'https://script.google.com/macros/s/AKfycbw3vCJK9P1eYtsjuDPPlPYaoGmW_BJiM9l6A20hntRS8o6T-E-9uTtMgOGrDBor1sfGKQ/exec',
  boot: ['INITIALIZING INTERFACE', 'LOADING PROFILE — E. THOMAS', 'READY'],
  tabs: [['status', 'Status', 'Állapot'], ['skills', 'Skills', 'Képességek'], ['inventory', 'Inventory', 'Leltár'], ['contact', 'Contact', 'Kapcsolat']],
  vitals: [['Based in', 'Budapest, HU'], ['Timezone', 'CET / UTC+1'], ['Focus', 'Gameplay systems'], ['Status', 'Open to work']],
  focus: [
    ['Systems', 'Combat, movement, inventory, progression — any kind found in existing games, and new ones too.'],
    ['Game feel', 'From a gamer to gamers — tailored to their needs to create the best experience possible.'],
    ['Prototyping', 'Fast, disposable builds that answer one design question before the real work starts.'],
    ['Collaboration', 'Comfortable owning a feature end to end with designers, artists and audio.']
  ],
  /* rgb: branch colour; soft: its light text tint. */
  skills: [
    { title: 'Gameplay Systems', note: 'What I build', rgb: '178,86,79', soft: '234,176,168',
      items: ['Combat systems', 'Inventory & crafting', 'Character controllers', 'AI behaviour trees', 'Progression & economy', 'Save systems', 'Physics interactions', 'Ability frameworks'] },
    { title: 'Engines & Tools', note: 'Where I build it', rgb: '186,152,72', soft: '238,214,152',
      items: ['Unreal Engine', 'Unity', 'GameMaker', 'Perforce', 'Git', 'YouTrack', 'Jira', 'Trello', 'Miro', 'Figma', 'Blender (basics)'] },
    { title: 'Languages', note: 'How I build it', rgb: '110,168,130', soft: '196,234,208',
      items: ['Blueprints', 'C#', 'C++', 'Python'] },
    { title: 'Design', note: 'The other half', rgb: '92,140,176', soft: '186,214,238',
      items: ['Systems design', 'Level blockout', 'Rapid prototyping', 'Playtest facilitation', 'Design documentation', 'Balance & tuning'] }
  ],
  links: [
    ['itch.io', 'itch.io/profile/ermendq', 'https://itch.io/profile/ermendq'],
    ['GitHub', 'github.com/ermendq', 'https://github.com/ermendq'],
    ['LinkedIn', 'linkedin.com/in/erik-thomas-abb447262', 'https://www.linkedin.com/in/erik-thomas-abb447262/']
  ],
  cv: { en: 'assets/Erik-Thomas-CV-EN.pdf', hu: 'assets/Erik-Thomas-CV-HU.pdf' },
  projects: [
    {
      slot: '01',
      name: 'Faceless',
      engine: 'Unreal',
      year: '2026',
      tags: ['2026', 'Unreal', 'Horror'],
      cover: 'sys02-shot-d.png',
      youtube: 'pt9L98uNJyE',
      download: 'https://drive.proton.me/urls/F00M0EPDBG#k60GFZpWcBzs',
      blurb: 'A horror project demo featuring an old creepypasta, the Slenderman, and drawing inspiration from the classic horrors Resident Evil and Silent Hill.',
      meta: [
        ['Role', 'Design & Programming'],
        ['Team', 'Solo development'],
        ['Engine', 'Unreal Engine / Blueprints'],
        ['Duration', '4 months']
      ],
      built: [
        'Slot based classic horror inventory system',
        'Horror events with basic combat',
        'Linear puzzle based map design including level optimization',
        'Main menu scene and intro cinematic'
      ],
      systems: [
        {
          title: 'Slot based inventory',
          body: 'The inventory screen is built on a slot based grid in the vein of Resident Evil. Items can be used, examined, combined or discarded. Examining an item opens a 3D preview the player can rotate to inspect. Combining highlights the items that pair into something new, and a separate craft menu lists the recipes already discovered.\n\nThe same screen holds the current objective and every document collected so far — clues about the world and its events that the player may need later. Hovering a document’s title displays its text in the centre of the screen.\n\nA missing poster appears in the bottom left once the player picks it up early in the game. Later it doubles as a visual indicator of the player’s sanity.',
          blueprint: ['BPC_SurvivalHorrorInventory.uasset', 'BP_ItemNew.uasset'],
          media: ['sys01-shot-b.png', 'sys01-shot-a.png', 'sys01-shot-c.png', 'sys01-inventory.mp4', 'sys01-crafting.mp4']
        },
        {
          title: 'Scare sequencing',
          body: 'Throughout the game a dark figure with glowing eyes appears and stalks the player as a manifestation of their psyche. Each encounter takes one of three forms:\n— it spawns for a brief moment, then vanishes\n— it stands facing the player and only disappears once the player moves closer\n— it spawns in the distance and teleports periodically closer, and the player has to shoot it to make it disappear\n\nEvery encounter drops the player’s sanity. The drop is visualised by the missing poster in the inventory turning steadily more uncanny, and past a threshold whispers begin to play while the inventory is open — louder the lower the sanity falls.',
          blueprint: ['BP_Watcher.uasset', 'BP_Crawler.uasset'],
          media: ['sys02-shot-d.png', 'sys02-shot-f.png', 'sys02-poster-decay.png', 'sys02-scare.mp4', 'sys02-stalker.mp4']
        },
        {
          title: 'Weapon system',
          body: 'Once the player gets hold of a gun and ammo, they can aim and shoot it.\n\nAiming narrows the field of view, lowers look sensitivity and movement speed, fades in an ammo indicator — which marks the round in the chamber in a separate colour when the magazine is full — and reveals a circular crosshair.\n\nShooting spawns a smoke and muzzle flash particle system that throws light around the barrel for a brief moment. A camera shake plays, the control rotation kicks slightly upward, and the crosshair expands and fades out to sell the recoil.\n\nReloading blocks every other action until the animation finishes, then loads a round into the chamber.',
          blueprint: ['BP_HorrorCharacter.uasset', 'BP_Bullet.uasset'],
          media: ['sys03-weapons.mp4']
        },
        {
          title: 'Level design and events',
          body: 'The main menu is designed to hint at the world and at the main character through the substances, drawings and documents laid out on it.\n\nThe intro scene borrows the logic of endless runner games: it keeps generating the same road prefab and triggers events on a timer.\n\nThe main level is paced to slowly introduce new information, mechanics and scares, keeping the gameplay eventful while still giving the player enough time to play around and take in the environment — and exploration is rewarded.\n\nThe player can also interact with different objects to progress through the level, and has to work out which item or piece of information they need for each one.\n\nThe map is optimized as well: meshes and foliage use culling distances, lights and assets are unloaded as the player progresses, and certain areas behind them get locked.',
          blueprint: [
            'ExampleMap.umap',
            'BP_EnvironmentInteractMaster.uasset',
            'BP_EventTrigger.uasset',
            'BP_SearchFindItem.uasset',
            'BP_StoneHidingKey.uasset',
            'BP_LockedCarWithID.uasset',
            'BP_Intercom.uasset',
            'BP_Bag.uasset',
            'BP_FinishGame.uasset'
          ],
          media: [
            'sys04-interactions.png',
            'faceless-sys04-overview.png',
            'faceless-sys04-topdown.png',
            'faceless-sys04-roadloop.png',
            'faceless-sys04-lamp.png',
            'faceless-sys04-desk-lit.png',
            'faceless-sys04-desk-unlit.png',
            'sys04-events.mp4'
          ]
        }
      ]
    },
    {
      slot: '02',
      name: 'Bar Fight',
      engine: 'Unreal',
      year: '2026',
      tags: ['2025', '2026', 'Unreal', 'Coop', 'Simulator'],
      cover: 'bar-fight-cover.png',
      youtube: 'ZZlBnW_mtgc',
      download: 'https://drive.proton.me/urls/7HXNGZNXQR#6FAgBX2jj6vp',
      blurb: 'Run a chaotic bar together with your friends.',
      meta: [
        ['Role', 'Gameplay Programmer'],
        ['Team', '8 people'],
        ['Engine', 'Unreal Engine / Blueprints'],
        ['Duration', '10 months']
      ],
      built: ['Dynamic drink system', 'Tapping and pouring mechanics', 'Items interaction and management'],
      systems: [
        {
          title: 'Drink system',
          body: 'Drinks are poured into glasses from either the beer tap or the bottles:\n— To pour a beer, the player places a keg under the tap, sets a glass on the drip tray and pulls the tap’s lever.\n— To pour wine or shots, the player sets glasses on the table and holds the bottle above them while pouring.\n\nWhen different drinks are mixed, the glass changes colour accordingly. The mix is tracked precisely, and guests are dissatisfied unless they are served exactly what they ordered. Drinks also go stale if they are not served shortly after being poured.',
          blueprint: [
            'BP_BeerTap_Experimental.uasset',
            'BP_BottleMaster.uasset',
            'BPC_Pouring.uasset',
            'BPC_Glass.uasset',
            'BP_PourTarget.uasset',
            'BP_LiquidProjectile.uasset',
            'BP_DrinksGuide.uasset',
            'BarGameFunctions.uasset'
          ],
          media: [
            'barfight-sys03-clip1.mp4',
            'barfight-sys03-clip2.mp4',
            'barfight-sys03-clip3.mp4',
            'barfight-sys01-clip4.mp4'
          ]
        },
        {
          title: 'Items and restocking',
          body: 'Items in the game are mainly the different glasses used to serve the guests. The player can also use trays to carry several items at once.\n\nTo order new items, the player interacts with the ordering terminal, checks what is available for purchase and places an order. Shortly after, the delivery arrives at the drop-off point at the back of the storage area.',
          blueprint: ['BP_ItemMaster.uasset', 'BP_TrayMaster.uasset', 'BP_OrderingTerminal.uasset'],
          media: ['barfight-sys02-clip1.mp4', 'barfight-sys02-clip2.mp4']
        }
      ]
    },
    {
      slot: '03',
      name: 'Sim-Break',
      engine: 'Unreal',
      year: '2026',
      tags: ['2026', 'Unreal', 'Coop', 'Immersive-sim'],
      cover: 'sim-break-cover.png',
      youtube: '1eHT6BWg4Xc',
      download: 'https://drive.proton.me/urls/6SHMGW6KYG#hHESChRjZT4I',
      blurb: 'Set in a dystopian prison, you have to find a way to break out — alone, or with your fellow inmates.',
      meta: [
        ['Role', 'Game Design & Programming'],
        ['Team', '6 people'],
        ['Engine', 'Unreal Engine / Blueprints'],
        ['Duration', '6 months']
      ],
      built: [
        'Replicated player character/controller',
        'Various items with different functions and crafting',
        'Various interactable stations and a dynamic interaction system',
        'Minigames / Gimmicks'
      ],
      systems: [
        {
          title: 'Player',
          body: 'The player selects their character at the main menu before loading into the game. Each character has unique traits, listed in the selection menu.\n\nDuring play, players can review their character info, items and intel in the character menu.\n\nThe HUD displays:\n— Health\n— Inventory, including whether the equipped item is holstered\n— Item controls and hotkeys\n\nPlayers can walk, sprint, jump and toggle between crouching and standing. The stance is reflected on the HUD when relevant.\n\nFalling from higher floors causes fall damage scaled to the distance fallen. To replenish health, the player has to interact with a medical station.',
          blueprint: [
            'BP_FirstPersonCharacter.uasset',
            'W_PlayerHUD.uasset',
            'W_CharacterMenu.uasset',
            'W_CharacterSelection.uasset'
          ],
          media: [
            'simbreak-sys01-charselect.png',
            'simbreak-sys01-charsheet.png',
            'simbreak-sys01-clip1.mp4',
            'simbreak-sys01-clip2.mp4',
            'simbreak-sys01-clip3.mp4',
            'simbreak-sys01-clip4.mp4'
          ]
        },
        {
          title: 'Items',
          body: 'The prison holds a wide range of items, each serving a different purpose. Collected items appear on the HUD and in the player menu, where a short description explains their uses.\n\nItems can open up new areas, feed into crafting, or be used in combat.',
          blueprint: [
            'BP_PickupTestParent.uasset',
            'BP_Equip_GunMaster.uasset',
            'BP_Equip_MeleeMaster.uasset',
            'BP_Equip_ThrowMaster.uasset',
            'BP_ThrowItem_Master.uasset',
            'BP_CraftingStation_Master.uasset',
            'BP_CraftingStation_ItemPlacement.uasset',
            'W_InteractionOption.uasset',
            'W_ItemSlot.uasset',
            'W_WorldSpaceInteraction.uasset'
          ],
          media: [
            'simbreak-sys02-inventory.png',
            'simbreak-sys02-clip1.mp4',
            'simbreak-sys02-clip2.mp4',
            'simbreak-sys02-clip3.mp4'
          ]
        },
        {
          title: 'Interactions',
          body: 'There are all sorts of ways to reach new areas — though most of them sit behind a locked door, or a suspiciously not blown-up wall. Some unlocks only need the right item; others ask the player to clear a fingerprint matching minigame or to know the correct four digit code.\n\nSecurity cameras are placed throughout the prison and can be accessed from a terminal.',
          blueprint: [
            'BP_Test_EnvironmentalInteractableMaster.uasset',
            'BP_Test_DoorMaster.uasset',
            'BP_Test_ItemCabinet.uasset',
            'BP_ForceField.uasset',
            'BP_ForceFieldPanel.uasset',
            'BP_ExplosionWall.uasset',
            'BP_CameraStation.uasset',
            'W_Numpad.uasset',
            'W_SecurityCam.uasset',
            'W_Hacking.uasset',
            'W_WorldSpaceInteraction.uasset'
          ],
          media: [
            'simbreak-sys03-interaction.mp4',
            'simbreak-sys03-fingerprint.png',
            'simbreak-sys03-unlock.mp4',
            'simbreak-sys03-station.mp4',
            'simbreak-sys03-clip4.mp4',
            'simbreak-sys03-clip5.mp4',
            'simbreak-sys03-clip6.mp4'
          ]
        },
        {
          title: 'Journal',
          body: 'While exploring the prison, the player picks up rumours, finds documents, or notices things on their own. Important clues are added to the Log section of the player menu, so they can be revisited later and used as guidance.',
          blueprint: ['BP_MissionTriggerCollider.uasset', 'W_CharacterMenu.uasset'],
          media: [
            'simbreak-sys04-log.png',
            'simbreak-sys04-clip1.mp4',
            'simbreak-sys04-clip2.mp4',
            'simbreak-sys04-clip3.mp4'
          ]
        },
        {
          title: 'Inmates',
          body: 'Inmates are scattered all over the prison. Interacting with them mostly gets whatever is on their mind — only a fraction of it actually matters.\n\nOthers are willing to trade items, or play a round of Twenty and gamble for them.\n\nTwenty is a card game that takes blackjack as its base and bends the rules slightly. The cards are designed to carry the dystopian atmosphere: colours instead of suits, and a 2–10 + A, B, C, D numbering.',
          blueprint: ['BP_Inmate.uasset', 'BP_CardTable.uasset'],
          media: [
            'simbreak-sys05-talk.png',
            'simbreak-sys05-trade.png',
            'simbreak-sys05-cards.png',
            'simbreak-sys05-clip1.mp4'
          ]
        },
        {
          title: 'Multiplayer',
          body: 'Everything in the game is replicated and multiplayer ready. Players can create sessions with a lobby size of up to four. Others see active sessions in a server list and join from there. Once loaded into the server, the host can see how many players have joined and start the game for everyone once they are ready.\n\nWhen someone is downed — health reaching 0 — they are put in solitary. The remaining players can free them by either quiet or loud means.\n\nIf everyone ends up in solitary, the game is over.',
          blueprint: [
            'BP_FirstPersonCharacter.uasset',
            'W_MainMenu.uasset',
            'W_CreateServer.uasset',
            'W_ServerBrowser.uasset',
            'W_ServerCard.uasset',
            'BP_SolitaryArea.uasset',
            'BP_SolitaryControl.uasset'
          ],
          media: [
            'simbreak-sys06-host.png',
            'simbreak-sys06-join.png',
            'simbreak-sys06-lobby.png',
            'simbreak-sys06-caught.png',
            'simbreak-sys06-netmode.png'
          ]
        }
      ]
    },
    {
      slot: '04',
      name: 'Slenderman AI',
      engine: 'Unreal',
      year: '2026',
      tags: ['2026', 'Unreal', 'AI'],
      cover: 'slenderman-ai-cover.png',
      youtube: '5NSeKn_xnmY',
      download: 'https://drive.proton.me/urls/F00M0EPDBG#k60GFZpWcBzs',
      blurb: 'A school project experimenting with Unreal’s State Tree system and AI behaviour.',
      meta: [
        ['Role', 'Developer'],
        ['Team', 'Solo development'],
        ['Engine', 'Unreal / Blueprints / State Tree'],
        ['Duration', '2 months']
      ],
      built: ['Recreated the Slenderman AI based on the original game'],
      systems: [
        {
          title: 'Slenderman',
          body: 'The well-known creepypasta runs on a State Tree rather than a behaviour tree. A root Actions state holds four tasks — teleport behind the player, block their path, idle, and a kill move — each falling through to a shared Cooldown state before the tree loops back to the root.\n\nSplitting the behaviour this way keeps each action a small, self-contained task, so the stalking pattern can be re-tuned or extended by adding a state instead of rewiring the graph.\n\nThe actor’s blueprint also carries an aggression value that climbs constantly — over time, whenever a page is collected, and while the player is looking at him. Higher aggression scales up the teleport distances and raises the odds that he blocks the player’s path or uses it to close into kill range, so the tension keeps building across a run. The only way to stall him is to stare at him — but hold that stare too long and it brings up a death screen of its own.',
          blueprint: [
            'BP_Slendy.uasset',
            'Task_TeleportAroundPlayer.uasset',
            'STT_BlockPlayerPath.uasset',
            'STT_Idle.uasset',
            'STT_KillMove.uasset',
            'STT_Cooldown.uasset'
          ],
          media: ['slenderman-sys01-statetree.png', 'slenderman-sys01-forest.png']
        }
      ]
    },
    {
      slot: '05',
      name: 'Sam’s Journey',
      engine: 'Unreal',
      year: '2024',
      tags: ['Unreal', '2024', 'VR'],
      cover: 'sams-journey-cover.jpg',
      youtube: 'w4zUx0xE9WU',
      blurb: 'A calming VR world you explore without hands or controllers — built to hold a patient’s attention through medical treatment.',
      summary: 'A school project built for the client VRelax: an interactive VR experience that asks nothing of the player’s hands. Patients undergoing treatments that would otherwise make them anxious are often unable — or unwilling — to hold a controller, so every interaction had to be reachable without one, and the world had to stay gentle enough to be a distraction rather than a demand.',
      meta: [
        ['Role', 'Designer / Programmer'],
        ['Client', 'VRelax'],
        ['Team', '2 person team'],
        ['Engine', 'Unreal / VR'],
        ['Duration', '3 months']
      ],
      built: ['VR Interaction system', 'Objective driven easy gameplay'],
      systems: [
        {
          title: 'VR Controller and world',
          body: 'Built on Unreal’s VR template, the pawn places the player in a series of different worlds and settings across the game.',
          blueprint: ['VRPawn.uasset', 'MyFunctionLibrary.uasset', 'Map_1.umap'],
          media: ['sams-journey-sys01-menu.png']
        },
        {
          title: 'Interactable items',
          body: 'A circular crosshair sits at the centre of the player’s HUD so they can always tell what is in the middle of the screen. Objects are interacted with by looking directly at them for a few seconds, and the progress is shown by a circular bar filling around the crosshair.',
          blueprint: [
            'StickActor.uasset',
            'FishingRodActor.uasset',
            'ShovelActor.uasset',
            'doorActor.uasset',
            'doorActor1.uasset',
            'CoconutActor.uasset',
            'AppleActor.uasset',
            'FlowerActor.uasset',
            'BucketActor.uasset',
            'LogActor.uasset'
          ],
          media: ['sams-journey-sys02-tools.png', 'sams-journey-sys02-apples.png']
        }
      ]
    },
    {
      slot: '06',
      name: 'Procedural City Generator',
      engine: 'Unreal',
      year: '2024',
      tags: ['2024', 'Unreal', 'Procedural Generation'],
      cover: 'city-generator-cover.png',
      youtube: 'LJVsezpQsPw',
      blurb: 'A city street generator built to experiment with procedural asset generation in Unreal.',
      summary: 'A school project experimenting with procedural asset generation. Users can generate city streets and customise the light colours using existing meshes.',
      meta: [
        ['Role', 'Developer'],
        ['Team', 'Solo development'],
        ['Engine', 'Unreal / Blueprints'],
        ['Duration', '2 months']
      ],
      systems: [
        {
          title: 'PCG Blueprint',
          body: 'A single handler blueprint drives the whole generation. It takes a list of building meshes and scatters them across a bounded area, with the row and column counts, offsets, rotation and scale ranges all exposed as editable parameters.\n\nCustom colours can be supplied as an array, and a variety value decides how far each building drifts from the palette — so a street reads as one coherent district instead of random noise.',
          blueprint: ['BP_PCG_Handler.uasset'],
          media: ['city-sys01-street.png', 'city-sys01-meshes.png', 'city-sys01-bounds.png', 'city-sys01-colors.png']
        }
      ]
    },
    {
      slot: '07',
      name: 'Dream Up',
      engine: 'Unreal',
      year: '2025',
      tags: ['2025', 'Unreal', 'Side scroller', 'Platformer'],
      cover: 'dream-up-cover.jpg',
      youtube: 'vpWsCWfbNCE',
      blurb: 'A rapid-prototyped project built around the words “dream” and “up” as its core theme.',
      meta: [
        ['Role', 'Developer'],
        ['Team', 'Solo development'],
        ['Engine', 'Unreal / Blueprints'],
        ['Duration', '1 month']
      ],
      built: ['Side-scroller map design with a parallel world', 'Progression system', 'Platformer challenges'],
      systems: [
        {
          title: 'Parallel worlds',
          body: 'The level exists twice — the waking map and its dream counterpart — laid out over the same footprint. Platforms that block the way in one world are the path forward in the other, so progress means reading both layouts at once and switching at the right spot.\n\nSwitching keeps the player’s position and momentum, which turns the swap itself into a platforming move: leap in one world, land in the other.',
          blueprint: [
            'BP_SideScrollingCharacter.uasset',
            'DreamFunctionLibrary.uasset',
            'BP_NightmarePlatform.uasset',
            'BP_NightmareTurret.uasset'
          ]
        },
        {
          title: 'Progression',
          body: 'Light collectibles are scattered along the route and drive the progression. Each one picked up feeds a counter that unlocks the next stretch of the map, so the player is always pulled a little further out than feels comfortable.\n\nGating the map this way keeps the platforming challenges optional in difficulty but mandatory in volume — the player chooses which routes to take, not whether to take them.',
          blueprint: ['BP_PickUp.uasset', 'BP_CheckPoint.uasset', 'W_Skills.uasset']
        }
      ]
    },
    {
      slot: '08',
      name: 'CargoVR',
      engine: 'Unity',
      year: '2023',
      tags: ['2023', 'Unity', 'VR', 'Puzzle']
    },
    {
      slot: '09',
      name: 'FPS Pistol Pack',
      engine: 'Unreal',
      year: '2024',
      tags: ['2024', 'Unreal', 'FPS'],
      youtube: 'cZ9cMuSwHW8'
    },
    {
      slot: '10',
      name: 'My Terrarium',
      engine: 'Unreal',
      year: '2023',
      tags: ['2023', 'Unreal', 'Gardening']
    },
    {
      slot: '11',
      name: 'Untitled FPS',
      engine: 'Unreal',
      year: '2023',
      tags: ['2023', 'Unreal', 'FPS', 'Combat'],
      youtube: '8FR451sOyys'
    },
    {
      slot: '12',
      name: 'Haunted',
      engine: 'Unreal',
      year: '2022',
      tags: ['2022', 'Unreal', 'Endless Runner', 'Horror'],
      youtube: '_C1V8rwlVRA'
    },
    {
      slot: '13',
      name: 'Save the Century',
      engine: 'Unreal',
      year: '2026',
      tags: ['2026', 'Unreal', 'Simulation', 'Turn-based strategy']
    }
  ],
  hu: {
    'Game Designer / Gameplay Programmer': 'Játéktervező / Gameplay programozó',
    'Back to Status': 'Vissza az állapothoz',
    Projects: 'Projektek',
    'INITIALIZING INTERFACE': 'INTERFÉSZ INDÍTÁSA',
    'LOADING PROFILE — E. THOMAS': 'PROFIL BETÖLTÉSE — E. THOMAS',
    READY: 'KÉSZ',
    Profile: 'Profil',
    'I design and build complex gameplay systems that feel simple in the hand — polished and fine-tuned until the intended player experience is achieved.': 'Összetett gameplay rendszereket tervezek és építek, amelyek kézbe véve mégis egyszerűnek hatnak — addig csiszolom őket, amíg a játékos pontosan azt éli át, amit szántam neki.',
    'Based in Budapest. I work across design and code: prototyping the mechanic, writing the systems that hold it up, then spending the long tail on feel — timings, input buffers, feedback, the hundred small corrections that turn a working feature into an entertaining one.': 'Budapesten élek. Tervezés és kód között mozgok: előbb prototípust építek a mechanikából, aztán megírom az alatta lévő rendszereket, a maradék időt pedig a játékérzetre fordítom — időzítések, input bufferek, visszajelzések, az a száz apró igazítás, amitől egy működő funkció szórakoztatóvá válik.',
    'Highlighted project': 'Kiemelt projekt',
    'OPEN CASE STUDY →': 'ESETTANULMÁNY →',
    'Based in': 'Lakhely',
    'Budapest, HU': 'Budapest',
    Timezone: 'Időzóna',
    Focus: 'Fókusz',
    'Gameplay systems': 'Gameplay rendszerek',
    'Open to work': 'Nyitott ajánlatokra',
    Systems: 'Rendszerek',
    'Combat, movement, inventory, progression — any kind found in existing games, and new ones too.': 'Harc, mozgás, leltár, fejlődés — bármi, ami a létező játékokban megtalálható, és olyan is, ami még nem.',
    'Game feel': 'Játékérzet',
    'From a gamer to gamers — tailored to their needs to create the best experience possible.': 'Játékostól játékosoknak — az ő igényeikre szabva, a lehető legjobb élményért.',
    Prototyping: 'Prototípusok',
    'Fast, disposable builds that answer one design question before the real work starts.': 'Gyors, eldobható buildek, amelyek egyetlen tervezői kérdést válaszolnak meg, mielőtt elkezdődne az igazi munka.',
    Collaboration: 'Együttműködés',
    'Comfortable owning a feature end to end with designers, artists and audio.': 'Otthonosan viszek végig egy funkciót az elejétől a végéig, tervezőkkel, grafikusokkal és hangosokkal együtt.',
    'Gameplay Systems': 'Gameplay rendszerek',
    'What I build': 'Amit építek',
    'Engines & Tools': 'Motorok és eszközök',
    'Where I build it': 'Amiben építem',
    Languages: 'Nyelvek',
    'How I build it': 'Ahogy építem',
    Design: 'Tervezés',
    'The other half': 'A másik fele',
    'Combat systems': 'Harcrendszerek',
    'Inventory & crafting': 'Leltár és craftolás',
    'Character controllers': 'Karaktervezérlők',
    'AI behaviour trees': 'AI viselkedésfák',
    'Progression & economy': 'Fejlődés és gazdaság',
    'Save systems': 'Mentésrendszerek',
    'Physics interactions': 'Fizikai interakciók',
    'Ability frameworks': 'Képességrendszerek',
    'Blender (basics)': 'Blender (alapok)',
    'Custom editor tooling': 'Egyedi editor eszközök',
    'Systems design': 'Rendszertervezés',
    'Level blockout': 'Pályavázlat',
    'Rapid prototyping': 'Gyors prototipizálás',
    'Playtest facilitation': 'Playtestek levezetése',
    'Design documentation': 'Tervezői dokumentáció',
    'Balance & tuning': 'Balansz és finomhangolás',
    'No projects match that filter': 'Nincs a szűrőnek megfelelő projekt',
    'Empty slot': 'Üres hely',
    available: 'szabad',
    'Reserved for the next shipped thing.': 'A következő elkészült munkának fenntartva.',
    '← BACK TO INVENTORY': '← VISSZA A LELTÁRHOZ',
    'Open on YouTube': 'Megnyitás YouTube-on',
    'Watch on YouTube': 'Megtekintés YouTube-on',
    'Embedded playback needs the site to be served over http — it works once published.': 'A beágyazott lejátszáshoz az oldalt http-n kell kiszolgálni — közzététel után működni fog.',
    'Gameplay capture': 'Gameplay felvétel',
    'CASE STUDY': 'ESETTANULMÁNY',
    'Download for Windows': 'Letöltés Windowsra',
    'What I built': 'Amit én építettem',
    'Systems breakdown': 'Rendszerek részletesen',
    'How it works under the hood': 'Mi történik a motorháztető alatt',
    'SEE BLUEPRINT': 'BLUEPRINT MEGNYITÁSA',
    'Blueprint viewer': 'Blueprint néző',
    Previous: 'Előző',
    Next: 'Következő',
    'Close ✕': 'Bezárás ✕',
    'Big screen': 'Nagy képernyő',
    Recruit: 'Toborzás',
    'Available for gameplay programming, systems design or creative development work — contract or full-time.': 'Szabad kapacitással vállalok gameplay programozást, rendszertervezést vagy kreatív fejlesztési munkát — szerződéses vagy teljes állásban.',
    'Happiest on a team that ships. Send a build, a design doc, or a rough idea and I\'ll tell you honestly what I\'d do with it.': 'Olyan csapatban érzem jól magam, amelyik ki is adja, amit csinál. Küldj egy buildet, egy design dokumentumot vagy egy nyers ötletet, és őszintén megmondom, mit kezdenék vele.',
    'You can email me at:': 'E-mailben itt érsz el:',
    Feedback: 'Visszajelzés',
    'This portfolio is still being polished and iterated on constantly. If something reads oddly, looks broken, or could simply be better — tell me. Every note is welcome.': 'A portfólió folyamatosan csiszolás és átdolgozás alatt áll. Ha valami furcsán hangzik, hibásnak tűnik, vagy egyszerűen jobb lehetne — írd meg. Minden észrevételnek örülök.',
    'Your name (optional)': 'Neved (nem kötelező)',
    'Email for a reply (optional)': 'E-mail a válaszhoz (nem kötelező)',
    'What worked, what didn’t, what you’d change…': 'Mi működött, mi nem, mit változtatnál…',
    'SEND FEEDBACK →': 'VISSZAJELZÉS KÜLDÉSE →',
    'THANKS — YOUR NOTE IS LOGGED': 'KÖSZÖNÖM — A VISSZAJELZÉS MENTVE',
    'WRITE SOMETHING FIRST': 'ÍRJ ELŐBB VALAMIT',
    'Prefer email? Click to copy': 'Inkább e-mail? Kattints a másoláshoz',
    'COPIED TO CLIPBOARD': 'A VÁGÓLAPRA MÁSOLVA',
    COPY: 'MÁSOLÁS',
    COPIED: 'MÁSOLVA',
    'Résumé': 'Önéletrajz',
    'Download PDF': 'PDF letöltése',
    'Upload in progress…': 'Feltöltés folyamatban…',
    Role: 'Szerep',
    Team: 'Csapat',
    Engine: 'Motor',
    Duration: 'Időtartam',
    Client: 'Megbízó',
    'Design & Programming': 'Tervezés és programozás',
    'Solo development': 'Egyedüli fejlesztés',
    'Designer / Programmer': 'Tervező / Programozó',
    '2 person team': '2 fős csapat',
    'Game Design & Programming': 'Játéktervezés és programozás',
    'Gameplay Programmer': 'Gameplay programozó',
    Developer: 'Fejlesztő',
    'Unreal / Blueprints / State Tree': 'Unreal / Blueprints / State Tree',
    '6 people': '6 fő',
    '8 people': '8 fő',
    '1 month': '1 hónap',
    '2 months': '2 hónap',
    '3 months': '3 hónap',
    '4 months': '4 hónap',
    'A rapid-prototyped project built around the words “dream” and “up” as its core theme.': 'Gyors prototípus, amelynek magját a „dream” és „up” szavak adták.',
    'Side-scroller map design with a parallel world': 'Oldalnézetes pályatervezés párhuzamos világgal',
    'Parallel worlds': 'Párhuzamos világok',
    Progression: 'Fejlődés',
    'The level exists twice — the waking map and its dream counterpart — laid out over the same footprint. Platforms that block the way in one world are the path forward in the other, so progress means reading both layouts at once and switching at the right spot.\n\nSwitching keeps the player’s position and momentum, which turns the swap itself into a platforming move: leap in one world, land in the other.': 'A pálya kétszer létezik — az éber világ és annak álombeli párja — ugyanarra az alaprajzra építve. Ami az egyik világban elzárja az utat, a másikban éppen az út maga, így a haladáshoz mindkét elrendezést egyszerre kell olvasni, és a megfelelő ponton váltani.\n\nA váltás megőrzi a játékos helyzetét és lendületét, így maga a világváltás is platformer-mozdulattá válik: az egyik világban ugrasz el, a másikban érsz földet.',
    'Light collectibles are scattered along the route and drive the progression. Each one picked up feeds a counter that unlocks the next stretch of the map, so the player is always pulled a little further out than feels comfortable.\n\nGating the map this way keeps the platforming challenges optional in difficulty but mandatory in volume — the player chooses which routes to take, not whether to take them.': 'A fénygyűjtők végig ott vannak az útvonalon, és ők hajtják a fejlődést. Minden felvett darab egy számlálót töltöget, ami megnyitja a pálya következő szakaszát — a játékos így mindig egy kicsivel messzebb merészkedik, mint amit kényelmesnek érez.\n\nEz a kapuzás azt jelenti, hogy a platformer-kihívások nehézségben választhatók, mennyiségben viszont nem: a játékos azt döntheti el, melyik utat választja, nem azt, hogy választ-e egyáltalán.',
    'Progression system': 'Fejlődési rendszer',
    'Platformer challenges': 'Platformer kihívások',
    '6 months': '6 hónap',
    '10 months': '10 hónap',
    Coop: 'Co-op',
    Simulator: 'Szimulátor',
    Simulation: 'Szimuláció',
    'Immersive-sim': 'Immerzív sim',
    'Procedural Generation': 'Procedurális generálás',
    Puzzle: 'Logikai',
    Gardening: 'Kertészkedés',
    Combat: 'Harc',
    'Endless Runner': 'Végtelen futó',
    'Side scroller': 'Oldalnézetes',
    'Turn-based strategy': 'Körökre osztott stratégia',
    'A horror project demo featuring an old creepypasta, the Slenderman, and drawing inspiration from the classic horrors Resident Evil and Silent Hill.': 'Horror demó egy régi creepypasta, a Slender Man főszereplésével, a klasszikus horrorok — a Resident Evil és a Silent Hill — nyomdokain.',
    'Slot based classic horror inventory system': 'Slot alapú, klasszikus horror leltárrendszer',
    'Horror events with basic combat': 'Horror események alapszintű harcrendszerrel',
    'Linear puzzle based map design including level optimization': 'Lineáris, rejtvényekre épülő pályatervezés, optimalizálással együtt',
    'Main menu scene and intro cinematic': 'Főmenü jelenet és bevezető átvezető',
    'Slot based inventory': 'Slot alapú leltár',
    'The inventory screen is built on a slot based grid in the vein of Resident Evil. Items can be used, examined, combined or discarded. Examining an item opens a 3D preview the player can rotate to inspect. Combining highlights the items that pair into something new, and a separate craft menu lists the recipes already discovered.\n\nThe same screen holds the current objective and every document collected so far — clues about the world and its events that the player may need later. Hovering a document’s title displays its text in the centre of the screen.\n\nA missing poster appears in the bottom left once the player picks it up early in the game. Later it doubles as a visual indicator of the player’s sanity.': 'A leltárképernyő slot alapú rácsra épül, a Resident Evil szellemében. A tárgyakat használni, megvizsgálni, kombinálni vagy eldobni lehet. A vizsgálat 3D-s nézetet nyit, amelyben a játékos körbeforgathatja a tárgyat. Kombináláskor kiemelődnek azok a tárgyak, amelyek valami újjá állnak össze, a külön craft menü pedig a már felfedezett recepteket sorolja fel.\n\nUgyanezen a képernyőn található az aktuális cél és minden eddig összegyűjtött dokumentum — nyomok a világról és az eseményeiről, amelyekre a játékosnak később szüksége lehet. Egy dokumentum címe fölé húzva az egeret a szöveg a képernyő közepén jelenik meg.\n\nA bal alsó sarokban egy eltűnt személyt kereső plakát jelenik meg, miután a játékos a játék elején felveszi. Később ez mutatja vizuálisan a játékos mentális állapotát is.',
    'Scare sequencing': 'Ijesztések vezénylése',
    'Throughout the game a dark figure with glowing eyes appears and stalks the player as a manifestation of their psyche. Each encounter takes one of three forms:\n— it spawns for a brief moment, then vanishes\n— it stands facing the player and only disappears once the player moves closer\n— it spawns in the distance and teleports periodically closer, and the player has to shoot it to make it disappear\n\nEvery encounter drops the player’s sanity. The drop is visualised by the missing poster in the inventory turning steadily more uncanny, and past a threshold whispers begin to play while the inventory is open — louder the lower the sanity falls.': 'A játék során újra és újra feltűnik egy sötét, világító szemű alak, amely a játékos elméjének megtestesüléseként követi őt. Minden találkozás háromféle formát ölthet:\n— egy pillanatra megjelenik, majd eltűnik\n— a játékossal szemben áll, és csak akkor tűnik el, ha a játékos közelebb megy\n— a távolban jelenik meg, és időről időre közelebb teleportál; a játékosnak rá kell lőnie, hogy eltűnjön\n\nMinden találkozás rontja a játékos mentális állapotát. A romlást a leltárban lévő plakát mutatja, amely egyre nyugtalanítóbbá válik, egy küszöb alatt pedig suttogások indulnak el, amíg a leltár nyitva van — annál hangosabban, minél mélyebbre süllyed az elme.',
    'Weapon system': 'Fegyverrendszer',
    'Once the player gets hold of a gun and ammo, they can aim and shoot it.\n\nAiming narrows the field of view, lowers look sensitivity and movement speed, fades in an ammo indicator — which marks the round in the chamber in a separate colour when the magazine is full — and reveals a circular crosshair.\n\nShooting spawns a smoke and muzzle flash particle system that throws light around the barrel for a brief moment. A camera shake plays, the control rotation kicks slightly upward, and the crosshair expands and fades out to sell the recoil.\n\nReloading blocks every other action until the animation finishes, then loads a round into the chamber.': 'Amint a játékos fegyverhez és lőszerhez jut, célozhat és lőhet vele.\n\nCélzáskor szűkül a látómező, csökken a nézelődés érzékenysége és a mozgási sebesség, beúszik a lőszerkijelző — amely tele tárnál külön színnel jelöli a csőben lévő töltényt —, és megjelenik a kör alakú célkereszt.\n\nLövéskor füst- és torkolattűz-partikulumok indulnak, amelyek egy pillanatra megvilágítják a cső környékét. Megrázkódik a kamera, az irányzék enyhén felfelé rúg, a célkereszt pedig kitágul és elhalványul, hogy érezhető legyen a visszarúgás.\n\nAz újratöltés minden más műveletet blokkol, amíg az animáció le nem fut, majd tölténnyel tölti fel a csövet.',
    'Level design and events': 'Pályatervezés és események',
    'The main menu is designed to hint at the world and at the main character through the substances, drawings and documents laid out on it.\n\nThe intro scene borrows the logic of endless runner games: it keeps generating the same road prefab and triggers events on a timer.\n\nThe main level is paced to slowly introduce new information, mechanics and scares, keeping the gameplay eventful while still giving the player enough time to play around and take in the environment — and exploration is rewarded.\n\nThe player can also interact with different objects to progress through the level, and has to work out which item or piece of information they need for each one.\n\nThe map is optimized as well: meshes and foliage use culling distances, lights and assets are unloaded as the player progresses, and certain areas behind them get locked.': 'A főmenü úgy készült, hogy a rajta látható szerekkel, rajzokkal és dokumentumokkal utaljon a világra és a főszereplőre.\n\nA bevezető jelenet az endless runner játékok logikáját használja: folyamatosan ugyanazt az útszakaszt generálja, és időzítve indítja az eseményeket.\n\nA főpálya tempója úgy van felépítve, hogy lassan vezesse be az új információkat, mechanikákat és ijesztő pillanatokat: eseménydús marad a játékmenet, de a játékosnak marad ideje kipróbálni a dolgokat és megélni a környezetet — a felderítés pedig jutalmat is ad.\n\nA játékos különböző tárgyakkal is interakcióba léphet a pályán való előrehaladáshoz, és ki kell találnia, melyik tárgyra vagy információra van ehhez szüksége.\n\nA pálya optimalizálva is van: a meshek és a foliage culling távolságot használnak, a fények és az assetek kikerülnek a memóriából, ahogy a játékos előrehalad, a mögötte lévő területek pedig lezáródnak.',
    'A calming VR world you explore without hands or controllers — built to hold a patient’s attention through medical treatment.': 'Nyugtató VR-világ, amelyet kéz és kontroller nélkül lehet bejárni — azért készült, hogy lekösse a páciens figyelmét az orvosi kezelés alatt.',
    'A school project built for the client VRelax: an interactive VR experience that asks nothing of the player’s hands. Patients undergoing treatments that would otherwise make them anxious are often unable — or unwilling — to hold a controller, so every interaction had to be reachable without one, and the world had to stay gentle enough to be a distraction rather than a demand.': 'Iskolai projekt a VRelax megbízásából: interaktív VR-élmény, amely semmit nem kér a játékos kezétől. A szorongató kezelésen áteső páciensek gyakran nem tudnak — vagy nem akarnak — kontrollert fogni, ezért minden interakciónak elérhetőnek kellett lennie anélkül is, a világnak pedig elég szelídnek kellett maradnia ahhoz, hogy elterelje a figyelmet, ne pedig követeljen.',
    'VR Interaction system': 'VR interakciós rendszer',
    'Objective driven easy gameplay': 'Célvezérelt, könnyed gameplay',
    'VR Controller and world': 'VR irányítás és világ',
    'Built on Unreal’s VR template, the pawn places the player in a series of different worlds and settings across the game.': 'Az Unreal VR sablonjára épülő pawn a játék során több különböző világba és helyszínre helyezi a játékost.',
    'Interactable items': 'Interaktív tárgyak',
    'A circular crosshair sits at the centre of the player’s HUD so they can always tell what is in the middle of the screen. Objects are interacted with by looking directly at them for a few seconds, and the progress is shown by a circular bar filling around the crosshair.': 'A HUD közepén kör alakú célkereszt ül, így a játékos mindig tudja, mi van a képernyő közepén. A tárgyakkal úgy lehet interakcióba lépni, hogy néhány másodpercig egyenesen rájuk néz; az előrehaladást a célkereszt körül töltődő körív mutatja.',
    'Set in a dystopian prison, you have to find a way to break out — alone, or with your fellow inmates.': 'Egy disztópikus börtönben kell megtalálnod a kiutat — egyedül vagy a rabtársaiddal együtt.',
    'Replicated player character/controller': 'Replikált játékoskarakter és -vezérlő',
    'Various items with different functions and crafting': 'Sokféle tárgy eltérő funkciókkal és craftolással',
    'Various interactable stations and a dynamic interaction system': 'Többféle interaktív állomás és dinamikus interakciós rendszer',
    'Minigames / Gimmicks': 'Minijátékok / gimmickek',
    Player: 'Játékos',
    'The player selects their character at the main menu before loading into the game. Each character has unique traits, listed in the selection menu.\n\nDuring play, players can review their character info, items and intel in the character menu.\n\nThe HUD displays:\n— Health\n— Inventory, including whether the equipped item is holstered\n— Item controls and hotkeys\n\nPlayers can walk, sprint, jump and toggle between crouching and standing. The stance is reflected on the HUD when relevant.\n\nFalling from higher floors causes fall damage scaled to the distance fallen. To replenish health, the player has to interact with a medical station.': 'A játékos a főmenüben választ karaktert, mielőtt betöltene a játékba. Minden karakternek egyedi tulajdonságai vannak, ezeket a választómenü sorolja fel.\n\nJáték közben a karaktermenüben lehet átnézni a karakter adatait, a tárgyakat és az összegyűjtött információkat.\n\nA HUD a következőket mutatja:\n— Életerő\n— Leltár, benne azzal, hogy a felszerelt tárgy el van-e téve\n— Tárgyvezérlők és gyorsbillentyűk\n\nA játékos sétálhat, futhat, ugorhat, és válthat guggolás és állás között. A testhelyzet ott jelenik meg a HUD-on, ahol számít.\n\nA magasabb emeletekről leesve a zuhanás hosszához mérten sebződik. Az életerőt orvosi állomásnál lehet feltölteni.',
    Items: 'Tárgyak',
    'The prison holds a wide range of items, each serving a different purpose. Collected items appear on the HUD and in the player menu, where a short description explains their uses.\n\nItems can open up new areas, feed into crafting, or be used in combat.': 'A börtön tárgyak széles skáláját rejti, mindegyik más célt szolgál. Az összegyűjtött tárgyak megjelennek a HUD-on és a játékosmenüben, ahol rövid leírás magyarázza el a felhasználásukat.\n\nA tárgyak új területeket nyithatnak meg, craftoláshoz használhatók, vagy bevethetők harcban.',
    Interactions: 'Interakciók',
    'There are all sorts of ways to reach new areas — though most of them sit behind a locked door, or a suspiciously not blown-up wall. Some unlocks only need the right item; others ask the player to clear a fingerprint matching minigame or to know the correct four digit code.\n\nSecurity cameras are placed throughout the prison and can be accessed from a terminal.': 'Rengeteg módon el lehet jutni új területekre — csakhogy a legtöbbjük zárt ajtó vagy egy gyanúsan még fel nem robbantott fal mögött van. Néhány zárhoz elég a megfelelő tárgy; máshol ujjlenyomat-párosító minijátékot kell teljesíteni, vagy tudni kell a helyes négyjegyű kódot.\n\nA börtön egész területén biztonsági kamerák vannak, amelyeket egy terminálról lehet elérni.',
    Journal: 'Napló',
    'While exploring the prison, the player picks up rumours, finds documents, or notices things on their own. Important clues are added to the Log section of the player menu, so they can be revisited later and used as guidance.': 'A börtön felderítése közben a játékos pletykákat hall, dokumentumokat talál, vagy magától vesz észre dolgokat. A fontos nyomok bekerülnek a játékosmenü Napló részébe, így később újra elő lehet venni és iránymutatásként használni őket.',
    Inmates: 'Rabtársak',
    'Inmates are scattered all over the prison. Interacting with them mostly gets whatever is on their mind — only a fraction of it actually matters.\n\nOthers are willing to trade items, or play a round of Twenty and gamble for them.\n\nTwenty is a card game that takes blackjack as its base and bends the rules slightly. The cards are designed to carry the dystopian atmosphere: colours instead of suits, and a 2–10 + A, B, C, D numbering.': 'A rabtársak a börtön minden pontján ott vannak. Ha megszólítod őket, többnyire azt kapod, ami épp jár a fejükben — ennek csak töredéke számít igazán.\n\nMások hajlandók tárgyat cserélni, vagy lejátszani egy kör Húszat, és feltenni rá a tárgyaikat.\n\nA Húsz egy kártyajáték, amely a blackjacket veszi alapul, és kicsit elhajlítja a szabályait. A lapok a disztópikus hangulatot viszik tovább: a francia színek helyett színek, és 2–10 + A, B, C, D számozás.',
    Multiplayer: 'Többjátékos mód',
    'Everything in the game is replicated and multiplayer ready. Players can create sessions with a lobby size of up to four. Others see active sessions in a server list and join from there. Once loaded into the server, the host can see how many players have joined and start the game for everyone once they are ready.\n\nWhen someone is downed — health reaching 0 — they are put in solitary. The remaining players can free them by either quiet or loud means.\n\nIf everyone ends up in solitary, the game is over.': 'A játékban minden replikált és többjátékosra kész. A játékosok legfeljebb négyfős lobbival hozhatnak létre szobát. A többiek a szerverlistában látják az aktív szobákat, és onnan csatlakoznak. A betöltés után a host látja, hányan léptek be, és amikor mindenki készen áll, elindíthatja a játékot.\n\nHa valaki kiesik — az életereje nullára csökken —, magánzárkába kerül. A többiek csendes vagy hangos úton szabadíthatják ki.\n\nHa mindenki magánzárkába kerül, a játéknak vége.',
    'Run a chaotic bar together with your friends.': 'Vezess egy kaotikus bárt a barátaiddal.',
    'Dynamic drink system': 'Dinamikus italrendszer',
    'Tapping and pouring mechanics': 'Csapolási és töltési mechanikák',
    'Items interaction and management': 'Tárgyinterakció és -kezelés',
    'Drink system': 'Italrendszer',
    'Drinks are poured into glasses from either the beer tap or the bottles:\n— To pour a beer, the player places a keg under the tap, sets a glass on the drip tray and pulls the tap’s lever.\n— To pour wine or shots, the player sets glasses on the table and holds the bottle above them while pouring.\n\nWhen different drinks are mixed, the glass changes colour accordingly. The mix is tracked precisely, and guests are dissatisfied unless they are served exactly what they ordered. Drinks also go stale if they are not served shortly after being poured.': 'Az italok vagy a csapból, vagy az üvegekből kerülnek a poharakba:\n— Sör csapolásához a játékosnak hordót kell tennie a csap alá, poharat a csepegtetőtálcára, majd meghúzni a csap karját.\n— Bor vagy rövid kitöltéséhez poharakat kell az asztalra tenni, és töltés közben föléjük tartani az üveget.\n\nHa különböző italok keverednek, a pohár színe ennek megfelelően változik. A rendszer pontosan követi az arányokat, és a vendégek elégedetlenek lesznek, ha nem pontosan azt kapják, amit rendeltek. Az italok ráadásul állottá válnak, ha nem szolgálják fel őket röviddel a töltés után.',
    'Items and restocking': 'Tárgyak és utánpótlás',
    'Items in the game are mainly the different glasses used to serve the guests. The player can also use trays to carry several items at once.\n\nTo order new items, the player interacts with the ordering terminal, checks what is available for purchase and places an order. Shortly after, the delivery arrives at the drop-off point at the back of the storage area.': 'A játékban a tárgyak elsősorban a vendégek kiszolgálásához használt poharak. A játékos tálcát is használhat, hogy egyszerre több tárgyat vigyen.\n\nÚj tárgyakat a rendelőterminálon lehet beszerezni: a játékos megnézi, mi kapható, és leadja a rendelést. Nem sokkal később a szállítmány megérkezik a raktár hátuljában lévő átvételi ponthoz.',
    'A school project experimenting with Unreal’s State Tree system and AI behaviour.': 'Iskolai projekt, amely az Unreal State Tree rendszerével és az MI viselkedésével kísérletezik.',
    'A city street generator built to experiment with procedural asset generation in Unreal.': 'Városiutca-generátor, amely az Unreal procedurális asset-generálásával kísérletezik.',
    'A school project experimenting with procedural asset generation. Users can generate city streets and customise the light colours using existing meshes.': 'Iskolai projekt a procedurális asset-generálás kipróbálására. A felhasználó városi utcákat generálhat, és meglévő mesheket felhasználva állíthatja be a fények színét.',
    Slenderman: 'Slenderman',
    'Recreated the Slenderman AI based on the original game': 'A Slenderman MI újraalkotása az eredeti játék alapján',
    'The well-known creepypasta runs on a State Tree rather than a behaviour tree. A root Actions state holds four tasks — teleport behind the player, block their path, idle, and a kill move — each falling through to a shared Cooldown state before the tree loops back to the root.\n\nSplitting the behaviour this way keeps each action a small, self-contained task, so the stalking pattern can be re-tuned or extended by adding a state instead of rewiring the graph.\n\nThe actor’s blueprint also carries an aggression value that climbs constantly — over time, whenever a page is collected, and while the player is looking at him. Higher aggression scales up the teleport distances and raises the odds that he blocks the player’s path or uses it to close into kill range, so the tension keeps building across a run. The only way to stall him is to stare at him — but hold that stare too long and it brings up a death screen of its own.': 'A jól ismert creepypasta nem behaviour tree-n, hanem State Tree-n fut. A gyökér Actions állapota négy taszkot fog össze — teleportálás a játékos mögé, útelzárás, várakozás és egy kill move —, és mindegyik egy közös Cooldown állapotba fut bele, mielőtt a fa visszatérne a gyökérhez.\n\nÍgy minden viselkedés külön, önálló taszk marad, tehát a követés mintája új állapot hozzáadásával hangolható vagy bővíthető, nem a gráf újrahuzalozásával.\n\nAz actor blueprintje emellett egy folyamatosan növekvő agresszióértéket is tárol — nő az idővel, minden összegyűjtött lappal, és miközben a játékos őt nézi. A magasabb agresszió megnöveli a teleportálási távolságokat, és nagyobb eséllyel zárja el a játékos útját vagy kerül így ölési távolságba, tehát a feszültség végig épül a játékmenet alatt. Feltartani egyedül úgy lehet, ha a játékos rábámul — de ha ezt túl sokáig teszi, az is halálképernyőhöz vezet.',
    'PCG Blueprint': 'PCG blueprint',
    'A single handler blueprint drives the whole generation. It takes a list of building meshes and scatters them across a bounded area, with the row and column counts, offsets, rotation and scale ranges all exposed as editable parameters.\n\nCustom colours can be supplied as an array, and a variety value decides how far each building drifts from the palette — so a street reads as one coherent district instead of random noise.': 'Az egész generálást egyetlen handler blueprint vezérli. Kap egy listát az épületmeshekből, és szétszórja őket egy határolt területen; a sorok és oszlopok száma, az eltolások, valamint a forgatási és méretezési tartományok mind szerkeszthető paraméterként vannak kivezetve.\n\nEgyedi színek tömbként adhatók meg, egy variációs érték pedig eldönti, mennyire tér el az egyes épületek színe a palettától — így az utca egységes városrésznek látszik, nem véletlenszerű zajnak.',
    Status: 'Státusz',
    Sections: 'Szakaszok',
    Language: 'Nyelv',
    'Play video': 'Videó lejátszása',
    'SENDING…': 'KÜLDÉS…',
    'COULDN’T SEND — PLEASE EMAIL ME INSTEAD': 'NEM SIKERÜLT ELKÜLDENI — ÍRJ INKÁBB E-MAILT',

    /* index-v3.html */
    'Quests': 'Küldetések',
    'Skills': 'Képességek',
    'Contact': 'Kapcsolat',
    'Quest log': 'Küldetésnapló',
    'Email me': 'Írj nekem',
    'Download CV': 'Önéletrajz letöltése',
    'Gameplay video': 'Gameplay videó',
    'Windows build': 'Windows build',
    'Locked quests': 'Zárolt küldetések',
    'Case study in progress': 'Az esettanulmány készül',
    'Objectives': 'Célok',
    'Back to quest log': 'Vissza a küldetésnaplóhoz',
    'Next quest': 'Következő küldetés',
    'Copy email address': 'E-mail-cím másolása',
    'Copied': 'Másolva',
    'Close': 'Bezárás',
    'Open blueprint': 'Blueprint megnyitása',
    'Send feedback': 'Visszajelzés küldése',
    'Sending…': 'Küldés…',
    'Thanks, your note is logged.': 'Köszönöm, a visszajelzés mentve.',
    'Write something first.': 'Írj előbb valamit.',
    'Couldn’t send. Please email me instead.': 'Nem sikerült elküldeni. Írj inkább e-mailt.',
    'Open quest': 'Küldetés megnyitása',
    'Menu': 'Menü',
    'Switch section': 'Szakaszváltás',
    'Back': 'Vissza'
  }
};
