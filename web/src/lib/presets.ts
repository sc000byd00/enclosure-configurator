// Generated from the generator's examples/*.yaml (s, m, l). Do not edit by hand.
import type { Board } from "./board";

export const PRESETS: Board[] = [
  {
    "name": "s",
    "title": "S: ESP32-C3 sensor tag 50 x 30",
    "board": {
      "size": [
        50,
        30
      ],
      "corner_radius": 1.0,
      "holes": [
        [
          3,
          3
        ],
        [
          47,
          3
        ],
        [
          3,
          27
        ],
        [
          47,
          27
        ]
      ],
      "standoff": 4.0,
      "component_height": 6.0
    },
    "components": [
      {
        "type": "usb-c",
        "side": "left",
        "pos": 15,
        "overhang": 0.6
      },
      {
        "type": "module",
        "x": 16,
        "y": 8,
        "w": 16.6,
        "d": 13.2,
        "h": 2.4
      },
      {
        "type": "led",
        "x": 40,
        "y": 8
      },
      {
        "type": "button",
        "x": 40,
        "y": 20,
        "dir": "-x"
      }
    ],
    "snap_hooks": {
      "front": [
        25
      ],
      "back": [
        25
      ]
    }
  },
  {
    "name": "m",
    "title": "M: ESP32 sensor node 70 x 50",
    "board": {
      "size": [
        70,
        50
      ],
      "holes": [
        [
          8,
          4
        ],
        [
          62,
          4
        ],
        [
          8,
          46
        ],
        [
          62,
          46
        ]
      ],
      "screw": "M2.5",
      "component_height": 12.0
    },
    "components": [
      {
        "type": "usb-c",
        "side": "left",
        "pos": 25,
        "overhang": 0.6
      },
      {
        "type": "module",
        "x": 36,
        "y": 16,
        "w": 25.5,
        "d": 18,
        "h": 3.1
      },
      {
        "type": "cap",
        "x": 20,
        "y": 14,
        "dia": 6.3,
        "h": 7.7
      },
      {
        "type": "header",
        "x": 36,
        "y": 42,
        "w": 20.3,
        "d": 2.5,
        "h": 8.5
      },
      {
        "type": "sensor",
        "x": 66,
        "y": 23.5,
        "w": 2.5,
        "d": 2.5,
        "h": 0.9
      },
      {
        "type": "vent",
        "side": "right",
        "pos": 25,
        "z": 1.5,
        "n": 5,
        "w": 1.6,
        "h": 7.0,
        "pitch": 3.4
      },
      {
        "type": "led",
        "x": 14,
        "y": 38
      },
      {
        "type": "button",
        "x": 26,
        "y": 38,
        "dir": "+x"
      }
    ],
    "snap_hooks": {
      "front": [
        8,
        62
      ],
      "back": [
        8,
        62
      ]
    }
  },
  {
    "name": "l",
    "title": "L: gateway 100 x 70, DC jack, terminal",
    "board": {
      "size": [
        100,
        70
      ],
      "corner_radius": 2.0,
      "holes": [
        [
          5,
          5
        ],
        [
          95,
          5
        ],
        [
          5,
          65
        ],
        [
          95,
          65
        ]
      ],
      "screw": "M3",
      "standoff": 6.0,
      "component_height": 14.0
    },
    "components": [
      {
        "type": "barrel",
        "side": "back",
        "pos": 14
      },
      {
        "type": "terminal",
        "side": "back",
        "pos": 32,
        "overhang": 0.3
      },
      {
        "type": "usb-c",
        "side": "left",
        "pos": 40,
        "overhang": 0.6
      },
      {
        "type": "module",
        "x": 52,
        "y": 20,
        "w": 25.5,
        "d": 18,
        "h": 3.1
      },
      {
        "type": "cap",
        "x": 30,
        "y": 24,
        "dia": 8,
        "h": 11.5
      },
      {
        "type": "sensor",
        "x": 96,
        "y": 40,
        "w": 2.5,
        "d": 2.5,
        "h": 0.9
      },
      {
        "type": "vent",
        "side": "right",
        "pos": 40,
        "z": 1.5,
        "n": 6,
        "w": 1.6,
        "h": 8.0,
        "pitch": 3.4
      },
      {
        "type": "led",
        "x": 88,
        "y": 58
      },
      {
        "type": "led",
        "x": 88,
        "y": 50
      },
      {
        "type": "button",
        "x": 88,
        "y": 30
      }
    ],
    "button": "cap",
    "snap_hooks": {
      "front": [
        20,
        50,
        80
      ],
      "back": [
        55,
        80
      ]
    },
    "wall_mount": [
      -28,
      28
    ]
  }
] as Board[];
