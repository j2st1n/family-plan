export const CATEGORIES = ["学习思考", "体育运动", "生活自理", "家务协助"];

export const CATEGORY_ICONS = {
  "学习思考": "📚",
  "体育运动": "🏃",
  "生活自理": "🌱",
  "家务协助": "🧹",
};

export const CATEGORY_KEYWORDS = {
  "学习思考": [
    "学习", "作业", "读", "写", "算术", "英语", "数学", "语文", "背诵", "练字",
    "画画", "思考", "编程", "实验", "考", "课", "阅读", "书", "乐高", "拼图",
    "奥数", "复习", "预习", "古诗", "日记", "练琴", "钢琴", "小提琴", "围棋",
    "科学", "地理", "历史", "诗词",
  ],
  "体育运动": [
    "运动", "跑", "跳", "绳", "球", "泳", "骑", "操", "步", "体能", "拉伸",
    "羽毛球", "乒乓球", "篮球", "足球", "游泳", "滑板", "轮滑", "武术", "跆拳道",
    "瑜伽", "散步", "爬山", "单杠", "俯卧撑", "仰卧起坐", "开合跳",
  ],
  "生活自理": [
    "起床", "睡觉", "睡", "刷牙", "洗脸", "洗澡", "穿衣", "喝水", "吃饭", "早睡",
    "早起", "午睡", "护眼", "防晒", "防蛀", "洗手", "吃药", "自理", "作息",
    "梳头", "剪指甲",
  ],
  "家务协助": [
    "家务", "洗碗", "扫地", "拖地", "擦桌", "倒垃圾", "收衣服", "叠被", "收拾",
    "整理", "做饭", "浇花", "喂宠物", "洗菜", "摆餐具", "协助", "帮妈妈", "帮爸爸",
    "擦窗", "扔垃圾", "洗衣服",
  ],
};

export function inferCategory(title = "", description = "") {
  const text = `${title} ${description}`.trim();
  if (!text) return "学习思考";
  let bestCat = "学习思考";
  let bestScore = 0;
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (text.includes(kw)) {
        score += kw.length;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestCat = cat;
    }
  }
  return bestCat;
}
