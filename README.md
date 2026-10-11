# CyberLaps

Interactive Cyber Defense & Systems Security Learning. A local teaching lab: you watch packets move, read them layer by layer, type simple commands, and save what you find.

This is a simulation. It does not scan real networks.

## Run it

```bash
npm install
npm run dev
```

Open the URL Vite prints. Start with Network Lab, Level 1.

## What you can do

- Step through a short intro in each level at your own pace with **Next step**
- Read a deeper lesson per level: packet structure, protocol behavior, and the defender's view
- Meet each new tool: the Lab Agent lets `ping`, `arp-scan`, and `nmap` explain themselves
- Use those tools in the terminal
- Click a moving packet to pause and read its headers
- Keep a ledger of discovered devices in this browser
- Switch the whole interface, lessons and guides between English and Arabic (right-to-left)
- Sign in or register a local demo account (nothing leaves the browser; passwords are never stored)

Every device on the map starts as an unverified **?** node. Its type, name, IP, MAC and services appear only after one of your discovery commands gets a valid reply in that level.

Each level has goals. They tick off by themselves when your commands prove them, and a level is complete only when every goal is proven. Finishing a level opens the next one. Pick any open level from the level map in the top bar.

Levels 1 to 10 are playable. Levels 11+ and other training areas are marked Coming Soon.

The terminal itself stays in English, like the real tools it imitates.

Built by [Rakan Alfaifi](https://github.com/RakanAlfaifi).
