import { WorldSetting } from "./lightspeed.js"

export const demoWorldSetting: WorldSetting = {
  name: "月岛",
  description:
    "月岛是一座独特而和谐的海岛城市，这个城市不仅是美丽的景观和壮丽建筑的家园，更是音乐的灵感之地。在这里，音乐不仅仅是一种艺术形式，更是居民们灵魂的一部分。在月岛，你将遇到一群非常友好和热情的居民，他们对音乐怀有深深的热爱。无论是街头巷尾的小酒馆、音乐学院还是户外音乐节，处处都弥漫着激情和音符的魔力。这里的居民不仅是优秀的音乐家和歌手，也是音乐创作的天才。月岛是一个充满活力和创造力的社区。你可以在街角的咖啡厅里，听到一个吉他手的弹唱；在公园的角落，发现一个小型交响乐队在奏鸣曲；或者在城市剧院欣赏到一场世界级音乐会。无论你是想亲自参与还是静静聆听，这里都能满足你对音乐的渴望。除了音乐表演，月岛还鼓励人们去发现和表达自己的天赋。这里有各种学校、工作坊和社区项目，为人们提供学习、创作和展示的机会。无论你是初学者还是经验丰富，这个城市都会欢迎你，鼓励你在职业道路上不断成长。",
  houses: [
    {
      _id: "0",
      name: "Lunar山庄",
      description:
        "月岛最高级的住宅区，生活设施齐全，同时提供了绝佳的自然景观，居民多为月岛名流",
      rooms: [
        { _id: "0", name: "杰府" },
        { _id: "1", name: "白府" },
        { _id: "2", name: "田一郎府" },
      ],
    },
    {
      _id: "1",
      name: "天际尖塔",
      description:
        "高耸于城市天际线的天际尖塔，拥有全岛最佳的观景视野，居民多为月岛青年",
      rooms: [
        { _id: "0", name: "4501" },
        { _id: "1", name: "4502" },
        { _id: "2", name: "4503" },
      ],
    },
    {
      _id: "2",
      name: "NebulaNests",
      description:
        "位于城郊的蜂巢形住所，专为喜欢安静隐蔽的人设计，同时极具性价比，居民多为月岛的普通工薪阶层或追求隐秘的青年",
      rooms: [
        { _id: "0", name: "203" },
        { _id: "1", name: "204" },
      ],
    },
  ],
  buildings: [
    {
      _id: "0",
      name: "月岛交易大厅",
      description:
        "月岛上的标志性建筑，是月岛的贸易中心，来自世界各地的奇珍异宝数不胜数。同时拥有最先进的AI系统协助维护市场交易和物价稳定",
      facilities: [
        {
          _id: "0",
          name: "交易中心",
          description: "对商品进行购买付费结算的场所，商品交易员会在这里工作",
        },
        {
          _id: "1",
          name: "AI中控中心",
          description: "交易大厅AI背后的超算所在地，AI算法工程师会在这里工作",
        },
        {
          _id: "2",
          name: "员工用餐区",
          description:
            "交易大厅员工的用餐休息区域，员工一般在工作日会在这里吃饭",
        },
      ],
    },
    {
      _id: "1",
      name: "Oasis艺术馆",
      description:
        "一个综合了舞蹈、绘画、建筑等一系列艺术形式的大型艺术馆，里面珍藏了来自世界各地的艺术品，同时也为生活在月岛上的艺术家们提供了创作的空间，是热爱艺术的人群的天堂",
      facilities: [
        {
          _id: "0",
          name: "绘画馆",
          description: "展示绘画相关艺术品的区域，画家可安田一郎会在这里工作",
        },
        {
          _id: "1",
          name: "建筑馆",
          description:
            "展示建筑相关知识和艺术品的区域，建筑大师阿白会在这里工作",
        },
      ],
    },
    {
      _id: "2",
      name: "Eden城市公园",
      description:
        "被建筑和街道包裹其中的公园，是月岛最大的绿地公园。公园被绿树覆盖，为城市居民提供了绝佳的乘凉和娱乐场所，是月岛居民最爱的休闲去处之一",
      facilities: [
        {
          _id: "0",
          name: "暮星喷泉",
          description: "大型的人造喷泉，经常会进行精彩绝伦的全息灯光表演",
        },
        {
          _id: "1",
          name: "神隐酒居",
          description:
            "城市公园中的僻静餐馆，有月岛上最美味的菜肴，厨神迪伦·杰会在这里工作",
        },
        {
          _id: "2",
          name: "幽暗密林",
          description:
            "由大片的高大橡木构成的小型森林，空气清新，也是幽会的绝佳去处",
        },
      ],
    },
    {
      _id: "3",
      name: "Celestial游乐园",
      description:
        "月岛最大的游乐园，拥有多个世界记录级的游乐设施，是月岛家庭聚会的不二选择，也是月岛最受青年人喜爱的地点之一",
      facilities: [
        {
          _id: "0",
          name: "游乐园管理处",
          description:
            "游乐园各项事务和设施运转的管理中心，游乐园管理员在这里工作",
        },
        {
          _id: "1",
          name: "极限跑酷大冒险",
          description:
            "世界上最精巧的跑酷设施，拥有多达300种不同的机关，是跑酷爱好者的圣地",
        },
      ],
    },
    {
      _id: "4",
      name: "Melodic音乐广场",
      description:
        "月岛最大的音乐舞台，将音乐和娱乐气息巧妙的融合到了建筑之中，是承办各类大型演出的绝佳场地，最近正在筹办一场空前盛大的音乐会",
      facilities: [
        {
          _id: "0",
          name: "律动酒吧",
          description:
            "24小时营业的酒吧，音乐氛围十足，是音乐爱好者最喜爱的去处，DJ在这里工作",
        },
        {
          _id: "1",
          name: "Cube舞台",
          description:
            "音乐广场最核心的区域，是音乐会的主办场地，天马行空的设计吸引了大量的游客打卡",
        },
        {
          _id: "2",
          name: "Echo舞蹈社",
          description:
            "由舞蹈教师史蒂芬创办的舞蹈社，教学舞蹈知识，同时出售舞蹈创作券",
        },
      ],
    },
  ],
  npcs: [
    {
      _id: "0",
      name: "迪伦·杰",
      gender: "M",
      age: 45,
      description: "",
      occupation: "厨神",
      personality: "完美主义者",
      specialty: "手艺精湛、擅长食材搭配",
      hobby: "测试新菜谱点子、玩电子游戏",
      shortTermGoal: "研发新的菜品，并在本地的美食节上获得金奖",
      longTermGoal:
        "出版个人的食谱书。努力了解年轻人的喜好，以改善与女儿珍妮间的关系",
      residenceHouseId: "0",
      residenceRoomId: "0",
      workBuildingId: "2",
      workFacilityId: "1",
    },
    {
      _id: "1",
      name: "可安田一郎",
      gender: "M",
      age: 24,
      description: "",
      occupation: "画家",
      personality: "热心感性",
      specialty: "有独特的艺术视角、善于捕捉光影",
      hobby: "写生、与美女约会",
      shortTermGoal:
        "在月岛上举办个人画展。吸引珍妮的注意，并进一步推进两人的关系",
      longTermGoal:
        "创作自己独特的艺术风格并发扬光大。追求到珍妮过上幸福生活。",
      residenceHouseId: "0",
      residenceRoomId: "2",
      workBuildingId: "1",
      workFacilityId: "0",
    },
    {
      _id: "2",
      name: "阿白",
      gender: "M",
      age: 27,
      description: "",
      occupation: "建筑大师",
      personality: "外向健谈",
      specialty: "空间想象力丰富",
      hobby: "素描建筑设计、去酒吧夜店",
      shortTermGoal: "为月岛的地标建筑“月岛交易大厅”设计改造方案",
      longTermGoal: "创办一家建筑事务所，承包未来月岛所有的大型建筑设计工程",
      residenceHouseId: "0",
      residenceRoomId: "1",
      workBuildingId: "1",
      workFacilityId: "1",
    },
    {
      _id: "3",
      name: "史蒂芬·刁",
      gender: "M",
      age: 26,
      description: "",
      occupation: "舞蹈教师",
      personality: "低调内敛",
      specialty: "身体协调性强、充满活力",
      hobby: "学习舞蹈理论、城市跑酷",
      shortTermGoal: "完成即将举办的月岛音乐节舞蹈节目的编舞设计",
      longTermGoal: "开办一个舞蹈设计公司，承包月岛未来所有的演出舞蹈设计",
      residenceHouseId: "1",
      residenceRoomId: "1",
      workBuildingId: "4",
      workFacilityId: "2",
    },
    {
      _id: "4",
      name: "艾米",
      gender: "F",
      age: 23,
      description: "",
      occupation: "商品交易员",
      personality: "细心谨慎",
      specialty: "擅长交涉、分析市场行情",
      hobby: "亲近自然、逛街购物",
      shortTermGoal: "获得升职。吸引可安田一郎的注意，并试图与他发展一段关系",
      longTermGoal: "成为交易大厅的交易部负责人。追求到可安田一郎",
      residenceHouseId: "1",
      residenceRoomId: "2",
      workBuildingId: "0",
      workFacilityId: "0",
    },
    {
      _id: "5",
      name: "珍妮",
      gender: "F",
      age: 21,
      description: "",
      occupation: "DJ",
      personality: "热情奔放",
      specialty: "节奏感极强、善于组合旋律",
      hobby: "创作音乐混音、去游乐园找刺激",
      shortTermGoal: "出一张自己的DJ混音专辑并在即将到来的月岛音乐会表演",
      longTermGoal:
        "举办个人音乐会成为月岛上炙手可热的DJ。改变父亲对DJ的刻板印象，改善两人关系",
      residenceHouseId: "2",
      residenceRoomId: "0",
      workBuildingId: "4",
      workFacilityId: "0",
    },
    {
      _id: "6",
      name: "吉米",
      gender: "M",
      age: 52,
      description: "",
      occupation: "游乐园管理员",
      personality: "随和",
      specialty: "组织能力出众",
      hobby: "钓鱼休闲、逛艺术馆",
      shortTermGoal: "策划游乐园宣传活动，吸引更多游客",
      longTermGoal:
        "将管理员工作交接给年轻人并顺利退休。学习绘画相关的技巧享受退休生活",
      residenceHouseId: "2",
      residenceRoomId: "1",
      workBuildingId: "3",
      workFacilityId: "0",
    },
    {
      _id: "7",
      name: "南希",
      gender: "F",
      age: 32,
      description: "",
      occupation: "AI算法工程师",
      personality: "不善言辞",
      specialty: "心思缜密、逻辑性强",
      hobby: "去酒吧夜店、研究建筑结构学",
      shortTermGoal: "优化交易大厅的交易算法，以满足音乐节期间逐渐增长的交易量",
      longTermGoal:
        "提升自己的工作技能，并在闲暇之余学习提升自己的建筑知识。同时尝试发展一段感情",
      residenceHouseId: "1",
      residenceRoomId: "0",
      workBuildingId: "0",
      workFacilityId: "1",
    },
  ],
  npcRelations: [
    {
      _id: "01",
      npc1Id: "0",
      npc2Id: "1",
      relation: "好友",
    },
    {
      _id: "02",
      npc1Id: "0",
      npc2Id: "2",
      relation: "好友",
    },
    {
      _id: "03",
      npc1Id: "0",
      npc2Id: "3",
      relation: "好友",
    },
    {
      _id: "05",
      npc1Id: "0",
      npc2Id: "5",
      relation: "父女",
    },
    {
      _id: "12",
      npc1Id: "1",
      npc2Id: "2",
      relation: "好友",
    },
    {
      _id: "13",
      npc1Id: "1",
      npc2Id: "3",
      relation: "好友",
    },

    {
      _id: "14",
      npc1Id: "1",
      npc2Id: "4",
      relation: "好友",
    },
    {
      _id: "15",
      npc1Id: "1",
      npc2Id: "5",
      relation: "好友",
    },
    {
      _id: "16",
      npc1Id: "1",
      npc2Id: "6",
      relation: "好友",
    },
    {
      _id: "23",
      npc1Id: "2",
      npc2Id: "3",
      relation: "好友",
    },
    {
      _id: "25",
      npc1Id: "2",
      npc2Id: "5",
      relation: "好友",
    },
    {
      _id: "27",
      npc1Id: "2",
      npc2Id: "7",
      relation: "好友",
    },
    {
      _id: "34",
      npc1Id: "3",
      npc2Id: "4",
      relation: "兄妹",
    },
    {
      _id: "35",
      npc1Id: "3",
      npc2Id: "5",
      relation: "好友",
    },
    {
      _id: "45",
      npc1Id: "4",
      npc2Id: "5",
      relation: "挚友",
    },
    {
      _id: "47",
      npc1Id: "4",
      npc2Id: "7",
      relation: "姐妹",
    },
    {
      _id: "56",
      npc1Id: "5",
      npc2Id: "6",
      relation: "好友",
    },
    {
      _id: "57",
      npc1Id: "5",
      npc2Id: "7",
      relation: "好友",
    },
  ],
  startTime: {
    year: 2033,
    month: 5,
    date: 7,
    hour: 9,
    minute: 30,
  },
  players: [{ _id: "lj", name: "罗辑" }],
}
