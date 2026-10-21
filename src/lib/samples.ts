import type { Lang } from './i18n'

export interface Sample {
  id: string
  name: string
  category: 'core' | 'data' | 'planning' | 'architecture'
  code: string
}

export const WELCOME: Record<Lang, string> = {
  ko: `flowchart LR
    idea([💡 아이디어]) --> write[Mermaid 코드 작성]
    write --> check{문법 오류?}
    check -->|없음| live[⚡ 실시간 렌더]
    check -->|있음| fix[✨ 자동 수정]
    fix -->|파서로 검증| live
    live --> share[(🔗 공유 · 내보내기)]

    classDef accent fill:#0f766e,stroke:#2dd4bf,color:#ecfeff
    class fix,live accent`,
  en: `flowchart LR
    idea([💡 Idea]) --> write[Write Mermaid]
    write --> check{Syntax error?}
    check -->|No| live[⚡ Live render]
    check -->|Yes| fix[✨ Auto-fix]
    fix -->|Parser verified| live
    live --> share[(🔗 Share · Export)]

    classDef accent fill:#0f766e,stroke:#2dd4bf,color:#ecfeff
    class fix,live accent`,
}

/** five classic mistakes in one diagram — the demo for auto-fix */
export const BROKEN_SAMPLE = `\`\`\`mermaid
graph TOP
    A[Start (beta)] -> B{Is it working?}
    B -->|Yes (finally)| C[Ship it]
    B —> D[Debug "everything"]
    D --> end
\`\`\``

export const SAMPLES: Sample[] = [
  {
    id: 'flowchart',
    name: 'Flowchart',
    category: 'core',
    code: `flowchart TD
    A[Christmas] -->|Get money| B(Go shopping)
    B --> C{Let me think}
    C -->|One| D[Laptop]
    C -->|Two| E[iPhone]
    C -->|Three| F[fa:fa-car Car]

    subgraph Store
      D
      E
    end`,
  },
  {
    id: 'sequence',
    name: 'Sequence',
    category: 'core',
    code: `sequenceDiagram
    autonumber
    actor U as User
    participant W as Web
    participant A as API
    participant D as DB
    U->>W: Click "Checkout"
    W->>+A: POST /orders
    A->>D: INSERT order
    alt payment ok
        D-->>A: order id
        A-->>W: 201 Created
    else card declined
        A-->>W: 402 Payment Required
    end
    deactivate A
    W-->>U: Show result
    Note over W,A: All calls are traced`,
  },
  {
    id: 'class',
    name: 'Class',
    category: 'core',
    code: `classDiagram
    class Animal {
      +String name
      +int age
      +makeSound() void
    }
    class Duck {
      +swim()
    }
    class Fish {
      -int sizeInFeet
      -canEat()
    }
    Animal <|-- Duck
    Animal <|-- Fish
    Duck "1" --> "*" Egg : lays`,
  },
  {
    id: 'state',
    name: 'State',
    category: 'core',
    code: `stateDiagram-v2
    [*] --> Idle
    Idle --> Loading : fetch()
    Loading --> Success : 200
    Loading --> Failure : error
    Failure --> Loading : retry
    Success --> [*]
    state Loading {
      [*] --> Requesting
      Requesting --> Parsing
      Parsing --> [*]
    }`,
  },
  {
    id: 'er',
    name: 'Entity Relationship',
    category: 'data',
    code: `erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE_ITEM : contains
    PRODUCT ||--o{ LINE_ITEM : "ordered in"
    CUSTOMER {
      string id PK
      string name
      string email
    }
    ORDER {
      string id PK
      string customer_id FK
      date created_at
    }`,
  },
  {
    id: 'gantt',
    name: 'Gantt',
    category: 'planning',
    code: `gantt
    title Product launch
    dateFormat YYYY-MM-DD
    excludes weekends
    section Design
      Research        :done, r1, 2026-01-05, 5d
      Wireframes      :active, w1, after r1, 4d
    section Build
      Frontend        :f1, after w1, 10d
      Backend         :b1, after w1, 12d
    section Launch
      QA              :crit, q1, after b1, 4d
      Release         :milestone, after q1, 0d`,
  },
  {
    id: 'pie',
    name: 'Pie',
    category: 'data',
    code: `pie showData
    title Where the time goes
    "Meetings" : 32
    "Coding" : 41
    "Code review" : 15
    "Coffee" : 12`,
  },
  {
    id: 'mindmap',
    name: 'Mindmap',
    category: 'planning',
    code: `mindmap
  root((Mermaid))
    Diagrams
      Flowchart
      Sequence
      Gantt
    Why
      Text based
      Version control
      Docs as code
    Where
      GitHub
      Notion
      Obsidian`,
  },
  {
    id: 'timeline',
    name: 'Timeline',
    category: 'planning',
    code: `timeline
    title History of the web
    1991 : First website
    1995 : JavaScript
         : PHP
    2004 : Web 2.0
    2008 : Chrome
    2014 : Mermaid`,
  },
  {
    id: 'git',
    name: 'Git graph',
    category: 'core',
    code: `gitGraph
    commit id: "init"
    branch develop
    checkout develop
    commit id: "feature A"
    branch feature/login
    commit id: "login form"
    checkout develop
    merge feature/login
    checkout main
    merge develop tag: "v1.0"
    commit id: "hotfix"`,
  },
  {
    id: 'journey',
    name: 'User journey',
    category: 'planning',
    code: `journey
    title Ordering coffee
    section Discover
      Open app: 5: Me
      Browse menu: 4: Me
    section Order
      Customize drink: 3: Me
      Pay: 2: Me, Bank
    section Pickup
      Wait in line: 1: Me
      Enjoy: 5: Me`,
  },
  {
    id: 'quadrant',
    name: 'Quadrant',
    category: 'data',
    code: `quadrantChart
    title Reach vs engagement
    x-axis Low reach --> High reach
    y-axis Low engagement --> High engagement
    quadrant-1 Expand
    quadrant-2 Promote
    quadrant-3 Re-evaluate
    quadrant-4 Improve
    Campaign A: [0.3, 0.6]
    Campaign B: [0.45, 0.23]
    Campaign C: [0.57, 0.69]
    Campaign D: [0.78, 0.34]`,
  },
  {
    id: 'xy',
    name: 'XY chart',
    category: 'data',
    code: `xychart-beta
    title "Monthly revenue"
    x-axis [jan, feb, mar, apr, may, jun]
    y-axis "Revenue (k$)" 0 --> 120
    bar [52, 60, 75, 82, 95, 110]
    line [52, 60, 75, 82, 95, 110]`,
  },
  {
    id: 'sankey',
    name: 'Sankey',
    category: 'data',
    code: `sankey-beta
Visits,Signup,420
Visits,Bounce,580
Signup,Trial,300
Signup,Churn,120
Trial,Paid,180
Trial,Churn,120`,
  },
  {
    id: 'block',
    name: 'Block',
    category: 'architecture',
    code: `block-beta
  columns 3
  frontend["Frontend"] api["API"] db[("Database")]
  space:3
  cache["Cache"]:3
  frontend --> api
  api --> db
  api --> cache`,
  },
  {
    id: 'architecture',
    name: 'Architecture',
    category: 'architecture',
    code: `architecture-beta
    group cloud(cloud)[Cloud]

    service web(internet)[Web] in cloud
    service api(server)[API] in cloud
    service db(database)[Database] in cloud
    service files(disk)[Storage] in cloud

    web:R --> L:api
    api:R --> L:db
    api:B --> T:files`,
  },
  {
    id: 'kanban',
    name: 'Kanban',
    category: 'planning',
    code: `kanban
  todo[Todo]
    t1[Write spec]
    t2[Design review]
  doing[In progress]
    t3[Auto-fix engine]
  done[Done]
    t4[Live preview]`,
  },
  {
    id: 'packet',
    name: 'Packet',
    category: 'architecture',
    code: `packet-beta
  title TCP header
  0-15: "Source port"
  16-31: "Destination port"
  32-63: "Sequence number"
  64-95: "Acknowledgment number"
  96-99: "Offset"
  100-105: "Reserved"
  106-111: "Flags"
  112-127: "Window"`,
  },
  {
    id: 'c4',
    name: 'C4 context',
    category: 'architecture',
    code: `C4Context
    title Internet banking
    Person(customer, "Customer", "A bank customer")
    System(banking, "Banking system", "Lets customers manage accounts")
    System_Ext(mail, "Email system", "Sends notifications")
    Rel(customer, banking, "Uses")
    Rel(banking, mail, "Sends email via")`,
  },
  {
    id: 'requirement',
    name: 'Requirement',
    category: 'planning',
    code: `requirementDiagram
    requirement fast_render {
      id: 1
      text: Render within 100ms
      risk: medium
      verifymethod: test
    }
    element preview {
      type: component
    }
    preview - satisfies -> fast_render`,
  },
  {
    id: 'radar',
    name: 'Radar',
    category: 'data',
    code: `radar-beta
  title Skills
  axis fe["Frontend"], be["Backend"], ops["Ops"], data["Data"], ux["UX"]
  curve alice["Alice"]{4, 3, 2, 5, 4}
  curve bob["Bob"]{2, 5, 4, 3, 2}
  max 5`,
  },
  {
    id: 'treemap',
    name: 'Treemap',
    category: 'data',
    code: `treemap-beta
"Budget"
    "Engineering"
        "Salaries": 60
        "Tools": 10
    "Marketing"
        "Ads": 20
        "Events": 10`,
  },
]
