// Standalone taxonomy: this module deliberately imports no application or seed-data modules.
const taxonomy = {
  中国菜: {
    川菜: {
      热菜: ['宫保鸡丁', '麻婆豆腐', '回锅肉', '水煮牛肉', '鱼香肉丝', '水煮鱼', '毛血旺', '辣子鸡', '鱼香茄子', '盐煎肉', '干煸牛肉丝', '干煸四季豆', '樟茶鸭', '粉蒸肉', '豆瓣鲫鱼', '家常豆腐'],
      凉菜: ['夫妻肺片', '口水鸡', '蒜泥白肉', '川北凉粉', '红油耳片', '伤心凉粉', '凉拌鸡丝', '泡椒凤爪'],
      汤羹: ['开水白菜', '酸辣汤', '连锅汤', '蹄花汤', '酸菜豆花汤'],
      面点主食: ['担担面', '钟水饺', '甜水面', '宜宾燃面', '四川凉面', '赖汤圆'],
      小吃: ['钵钵鸡', '龙抄手', '蛋烘糕', '三大炮', '叶儿粑'],
    },
    粤菜: {
      热菜: ['白切鸡', '豉汁蒸排骨', '清蒸东星斑', '菠萝咕咾肉', '白灼虾', '椒盐濑尿虾', '上汤焗龙虾', '避风塘炒蟹'],
      点心: ['虾饺', '烧卖', '肠粉', '叉烧包', '流沙包', '萝卜糕', '糯米鸡', '鲜竹卷', '马拉糕'],
      烧味: ['烧鹅', '叉烧', '烧肉', '烧鸭', '盐焗鸡', '脆皮乳猪'],
      汤羹: ['椰子炖鸡汤', '胡椒猪肚汤', '西洋菜猪骨汤', '冬瓜薏米老鸭汤', '虫草花炖鸡汤'],
      粥粉面饭: ['云吞面', '干炒牛河', '豉油皇炒面', '煲仔饭', '艇仔粥', '及第粥'],
      凉菜卤味: ['白云猪手', '卤水鹅', '卤水鸭舌', '卤水猪耳', '凉拌鱼皮', '沙姜猪手'],
    },
    湘菜: {
      热菜: ['剁椒鱼头', '小炒肉', '农家一碗香', '辣椒炒肉', '湘西土匪猪肝', '腊味合蒸', '永州血鸭', '东安子鸡', '毛氏红烧肉', '湘西酸肉', '麻辣子鸡', '攸县香干', '擂辣椒皮蛋', '干锅肥肠'],
      凉菜: ['湘西泡菜', '擂钵茄子', '凉拌蕨根粉', '湘西腊猪耳', '湘西酸萝卜'],
      汤羹: ['酸辣肚丝汤', '紫苏黄瓜汤', '衡阳鱼头豆腐汤', '湘西酸萝卜老鸭汤', '甲鱼炖羊肉'],
      米粉主食: ['湖南米粉', '常德牛肉粉', '栖凤渡鱼粉', '郴州鱼粉', '津市牛肉粉', '长沙米粉', '永州米豆腐'],
      小吃糕点: ['糖油粑粑', '臭豆腐', '口味虾', '姊妹团子', '葱油粑粑', '湘潭灯芯糕', '浏阳茴饼', '刮凉粉', '永州喝螺'],
    },
    鲁菜: {
      热菜: ['葱烧海参', '糖醋鲤鱼', '九转大肠', '油爆双脆', '爆炒腰花', '德州扒鸡', '四喜丸子', '锅塌豆腐', '锅塌里脊', '芙蓉鸡片', '赛螃蟹', '滑炒里脊丝', '炸蛎黄', '济南把子肉'],
      汤羹: ['奶汤蒲菜', '乌鱼蛋汤', '酸辣鱼肚', '西施舌羹', '清汤燕菜', '单县羊肉汤'],
      面食: ['山东煎饼', '鲅鱼水饺', '胶东大包', '蓬莱小面', '福山拉面', '潍坊肉火烧', '利津水煎包'],
      凉菜: ['济南酥锅', '五香酱牛肉', '青岛拌八带', '炝拌海蜇头', '蓑衣黄瓜', '蒜泥茄子'],
      小吃糕点: ['周村烧饼', '青岛锅贴', '济南甜沫', '蜜三刀', '签子馒头', '青岛脂渣', '枣庄菜煎饼', '高密炉包'],
    },
    苏菜: {
      热菜: ['清炖狮子头', '松鼠鳜鱼', '大煮干丝', '软兜长鱼', '三套鸭', '无锡排骨', '糖醋桂鱼', '碧螺虾仁', '梁溪脆鳝', '无锡肉酿面筋', '樱桃肉', '镜箱豆腐'],
      凉菜卤味: ['盐水鸭', '水晶肴肉', '苏式熏鱼', '香糟鹅', '卤汁豆干', '无锡酱鸭', '南京雨花茶干', '镇江香醋萝卜皮'],
      汤羹: ['文思豆腐', '鲃肺汤', '霸王别姬', '鸡汤煮干丝', '鸭血粉丝汤', '天目湖砂锅鱼头'],
      面点主食: ['扬州炒饭', '奥灶面', '锅盖面', '苏州汤面', '蟹黄汤包', '扬州三丁包', '翡翠烧卖', '千层油糕', '常州麻糕', '淮安茶馓'],
      小吃甜品: ['梅花糕', '海棠糕', '桂花糖芋苗', '赤豆元宵', '酒酿饼', '鸡头米羹', '无锡小笼包', '苏州糕团', '南京鸭油酥烧饼'],
    },
    浙菜: {
      热菜: ['西湖醋鱼', '龙井虾仁', '东坡肉', '干炸响铃', '叫化鸡', '油焖春笋', '宁波烤菜', '红烧划水', '生爆鳝片', '温州鱼饼', '杭州酱鸭', '火踵神仙鸭', '雪菜大汤黄鱼'],
      凉菜卤味: ['绍兴糟鸡', '醉蟹', '醉虾', '绍兴酱鸭', '金华火腿', '温州酱油肉', '舟山海蜇皮'],
      汤羹: ['宋嫂鱼羹', '西湖莼菜汤', '宁波三鲜汤', '鱼圆汤', '笋干老鸭煲', '赛蟹羹'],
      面点主食: ['片儿川', '杭州小笼包', '猫耳朵', '宁波汤圆', '嘉兴粽子', '嵊州小笼包', '舟山海鲜面', '温州糯米饭', '缙云烧饼', '绍兴炒年糕'],
      小吃糕点: ['定胜糕', '葱包烩', '吴山酥油饼', '绍兴臭豆腐', '松花团', '金华酥饼', '宁波油赞子', '绍兴香糕', '龙游发糕', '义乌东河肉饼'],
    },
    闽菜: {
      热菜: ['佛跳墙', '荔枝肉', '醉排骨', '鸡汤氽海蚌', '淡糟香螺片', '爆炒双脆', '南煎肝', '红糟鸡', '姜母鸭', '同安封肉', '沙茶焖鸭', '白斩河田鸡', '菊花鲈鱼'],
      汤羹: ['肉燕汤', '福州鱼丸汤', '海蛎羹', '鼎边糊', '面线糊', '花生汤', '平潭鱼丸汤'],
      面食主食: ['炒兴化米粉', '福州捞化', '厦门沙茶面', '海鲜卤面', '莆田卤面', '漳州卤面', '诏安手抓面', '泉州咸饭', '烧肉粽', '福鼎肉片'],
      小吃甜品: ['海蛎煎', '土笋冻', '五香卷', '牡蛎饼', '福州肉燕', '芋泥', '永春麻粩', '建瓯光饼', '碗仔粿', '马蹄酥', '九层粿', '闽南春卷'],
    },
    徽菜: {
      热菜: ['臭鳜鱼', '毛豆腐', '徽州一品锅', '黄山炖鸽', '问政山笋', '徽州刀板香', '李鸿章大杂烩', '方腊鱼', '清蒸石鸡', '徽州桃脂烧肉', '黄山双石', '笋干烧肉', '徽州蒸鸡', '徽州丸子', '屯溪醉蟹'],
      汤羹: ['火腿炖甲鱼', '中和汤', '徽州丸子汤', '石耳炖鸡', '黄山笋干炖火腿', '黄山野菜汤'],
      面点主食: ['黄山烧饼', '绩溪挞粿', '深渡包袱', '石头粿', '三河米饺', '徽州裹粽', '寿县大救驾', '合肥鸭油烧饼', '泾县锅贴', '阜阳格拉条', '太和板面'],
      小吃糕点: ['芙蓉糕', '五城茶干', '伏岭玫瑰酥', '合肥麻饼', '怀宁贡糕', '送灶粑粑', '绩溪菜糕', '祁门茶粿', '黄山字豆糖', '六安酱鸭'],
    },
    京津菜: { 热菜: ['北京烤鸭', '京酱肉丝', '锅塌里脊', '抓炒鱼片', '醋溜木须', '赛螃蟹', '烩乌鱼蛋', '烧羊肉'], 凉菜: ['老北京芥末墩', '水晶肘子', '拌豆腐丝', '酥鲫鱼'], 面点: ['炸酱面', '狗不理包子', '褡裢火烧', '门钉肉饼', '面茶'], 小吃: ['驴打滚', '豆汁焦圈', '糖耳朵', '豌豆黄', '炒肝'] },
    东北菜: { 热菜: ['锅包肉', '小鸡炖蘑菇', '猪肉炖粉条', '地三鲜', '溜肉段', '尖椒干豆腐', '雪衣豆沙'], 凉菜: ['东北大拉皮', '老虎菜', '蘸酱菜', '五香酱牛肉'], 炖菜: ['酸菜白肉', '得莫利炖鱼', '铁锅炖大鹅', '鲶鱼炖茄子'], 主食: ['粘豆包', '酸菜馅饺子', '朝鲜冷面', '玉米面贴饼子'], 小吃: ['烤冷面', '延吉打糕', '煎粉', '马迭尔冰棍'] },
    西北菜: { 热菜: ['大盘鸡', '手抓羊肉', '黄焖羊肉', '孜然羊肉', '葱爆羊肉', '烤全羊', '陕北烩菜'], 凉菜: ['凉拌面筋', '凉拌沙葱', '炝拌土豆丝', '陕北凉粉'], 面食: ['兰州牛肉面', '油泼面', '岐山臊子面', '裤带面', '揪面片', '羊肉臊子面'], 小吃: ['肉夹馍', '羊肉泡馍', '陕西凉皮', '柿子饼', '甑糕'] },
    云南菜: { 热菜: ['汽锅鸡', '小炒黄牛肉', '黑三剁', '宣威火腿炒饵块', '傣味柠檬鸡', '水性杨花炒蛋', '石屏豆腐', '青椒松茸', '宜良烤鸭蘸水'], 凉菜: ['凉拌米线', '鬼鸡', '傣味舂鸡脚', '凉拌树花'], 汤锅: ['野生菌火锅', '酸笋煮鱼', '土锅鸡'], 米线: ['过桥米线', '小锅米线', '豆花米线', '鳝鱼米线'], 小吃: ['鲜花饼', '破酥包', '宣威火腿月饼', '烤乳扇'] },
    贵州菜: { 热菜: ['酸汤鱼', '辣子鸡', '折耳根炒腊肉'], 主食: ['肠旺面'], 小吃: ['丝娃娃'] },
    潮汕菜: { 热菜: ['潮汕牛肉火锅', '卤鹅', '生腌'], 粿条: ['牛肉粿条汤'], 小吃: ['蚝烙'] },
    客家菜: { 热菜: ['梅菜扣肉', '客家酿豆腐', '盐焗鸡'], 汤羹: ['猪肚鸡'], 小吃: ['艾粄'] },
    港式: { 烧味: ['烧腊双拼', '蜜汁叉烧'], 茶餐厅: ['港式奶茶', '菠萝油', '叉烧饭'], 点心: ['流沙包'] },
    台式: { 热菜: ['三杯鸡', '卤肉饭', '盐酥鸡'], 小吃: ['蚵仔煎', '大肠包小肠'], 饮品: ['珍珠奶茶'] },
    素食: { 热菜: ['素炒时蔬', '麻婆豆腐（素）', '罗汉斋'], 主食: ['素面', '素炒饭'], 汤羹: ['菌菇汤'] },
    清真风味: { 热菜: ['孜然羊肉', '清炖牛肉', '手抓羊肉'], 面食: ['牛肉拉面', '馕'], 小吃: ['羊肉串'] },
    地方小吃: { 小吃: ['煎饼果子', '臭豆腐', '凉皮'], 米粉: ['螺蛳粉', '桂林米粉'], 糕点: ['绿豆糕'] },
    中式日常: { 家常热菜: ['番茄炒蛋', '青椒肉丝', '炒时蔬'], 主食: ['米饭', '面条', '饺子'], 汤羹: ['紫菜蛋花汤'], 其他中式: ['自定义', '其他'] },
  },
  东亚料理: {
    日料: { 刺身寿司: ['寿司', '刺身', '手卷'], 面饭: ['拉面', '乌冬面', '咖喱饭'], 烧物: ['照烧鸡', '鳗鱼饭'] },
    韩餐: { 汤锅: ['部队锅', '大酱汤', '参鸡汤'], 饭面: ['石锅拌饭', '冷面'], 小食: ['炸鸡', '炒年糕'] },
  },
  东南亚料理: {
    泰餐: { 热菜: ['冬阴功', '咖喱蟹', '打抛饭'], 主食: ['泰式炒河粉', '菠萝炒饭'], 小吃: ['虾饼'] },
    越南菜: { 汤粉: ['越南河粉'], 热菜: ['香茅烤鸡'], 小吃: ['春卷'] },
    '马来 / 新加坡风味': { 主食: ['海南鸡饭', '椰浆饭'], 汤面: ['叻沙'], 小吃: ['咖椰吐司'] },
    印尼菜: { 热菜: ['仁当牛肉', '沙嗲'], 主食: ['印尼炒饭'], 小吃: ['天贝'] },
  },
  南亚料理: {
    印度菜: { 咖喱: ['黄油鸡咖喱', '蔬菜咖喱', '咖喱羊肉'], 主食: ['印度飞饼', '抓饭'], 小吃: ['萨莫萨'] },
  },
  欧洲料理: {
    意餐: { 面食: ['意大利面', '千层面'], 披萨: ['玛格丽特披萨', '肉酱披萨'], 甜品: ['提拉米苏'] },
    法餐: { 主菜: ['油封鸭', '勃艮第牛肉'], 汤羹: ['法式洋葱汤'], 甜品: ['可丽露'] },
    西式简餐: { 主食: ['焗饭', '意式烩饭'], 主菜: ['烤鸡', '牛排'], 沙拉: ['凯撒沙拉'] },
  },
  美洲料理: {
    墨西哥菜: { 卷饼: ['塔可', '墨西哥卷饼'], 热菜: ['辣味炖豆'], 小吃: ['玉米片'] },
    美式餐: { 汉堡: ['牛肉汉堡', '鸡肉汉堡'], 烧烤: ['美式烤肋排'], 早午餐: ['松饼', '班尼迪克蛋'] },
  },
  '中东 / 地中海': {
    土耳其: { 烤肉: ['土耳其烤肉', '烤肉卷'], 主食: ['皮塔饼'], 甜品: ['巴克拉瓦'] },
    中东风味: { 烤肉: ['沙威玛', '烤羊肉'], 蘸酱: ['鹰嘴豆泥'], 主食: ['库斯库斯'] },
    地中海料理: { 沙拉: ['希腊沙拉'], 海鲜: ['烤章鱼'], 主食: ['海鲜饭'] },
  },
  跨地域: {
    轻食沙拉: { 沙拉: ['鸡胸肉沙拉', '谷物沙拉'], 碗餐: ['藜麦碗', '能量碗'], 饮品: ['果蔬昔'] },
    三明治汉堡: { 三明治: ['火腿芝士三明治', '鸡肉三明治'], 汉堡: ['牛肉汉堡', '素食汉堡'], 小食: ['薯条'] },
    咖啡烘焙: { 咖啡: ['美式咖啡', '拿铁'], 烘焙: ['可颂', '贝果'], 甜品: ['芝士蛋糕'] },
  },
};

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

export const DEFAULT_CUISINE_TAXONOMY = deepFreeze(taxonomy);
export const FALLBACK_TAXONOMY = deepFreeze({
  cuisineZone: '中国菜',
  cuisine: '中式日常',
  courseFamily: '其他中式',
  dishType: '自定义',
});

const PATH_KEYS = ['cuisineZone', 'cuisine', 'courseFamily', 'dishType'];
const TAXONOMY_PATHS = Object.entries(DEFAULT_CUISINE_TAXONOMY).flatMap(([cuisineZone, cuisines]) => (
  Object.entries(cuisines).flatMap(([cuisine, families]) => (
    Object.entries(families).flatMap(([courseFamily, dishTypes]) => (
      dishTypes.map((dishType) => ({ cuisineZone, cuisine, courseFamily, dishType }))
    ))
  ))
));

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cloneValue(value, seen = new Map()) {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return seen.get(value);
  if (Array.isArray(value)) {
    const copy = [];
    seen.set(value, copy);
    for (const item of value) copy.push(cloneValue(item, seen));
    return copy;
  }
  const copy = {};
  seen.set(value, copy);
  for (const [key, item] of Object.entries(value)) copy[key] = cloneValue(item, seen);
  return copy;
}

function normaliseText(value) {
  return typeof value === 'string' ? value.normalize('NFC').trim() : '';
}

function suppliedPath(meal) {
  return Object.fromEntries(PATH_KEYS.map((key) => [key, normaliseText(meal[key])]));
}

function isCompletePath(path) {
  return PATH_KEYS.every((key) => Boolean(path[key]));
}

function isCustomPath(path) {
  return isCompletePath(path) && (
    !Object.hasOwn(DEFAULT_CUISINE_TAXONOMY, path.cuisineZone)
    || PATH_KEYS.some((key) => path[key] === '自定义')
  );
}

function matchingPath(meal) {
  const supplied = suppliedPath(meal);
  if (!isCompletePath(supplied)) return FALLBACK_TAXONOMY;
  if (isCustomPath(supplied)) return supplied;
  return TAXONOMY_PATHS.find((path) => PATH_KEYS.every((key) => path[key] === supplied[key])) || FALLBACK_TAXONOMY;
}

/** Return a deep-cloned meal with one coherent, valid cuisine path. */
export function normaliseCuisineFields(meal) {
  const copy = isRecord(meal) ? cloneValue(meal) : {};
  return { ...copy, ...matchingPath(copy) };
}

/** Return the display path for a meal after normalising its cuisine fields. */
export function cuisinePath(meal) {
  const normalised = normaliseCuisineFields(meal);
  return PATH_KEYS.map((key) => normalised[key]).join(' / ');
}

function normaliseFilters(filters) {
  const source = isRecord(filters) ? filters : {};
  return {
    zone: normaliseText(source.zone),
    cuisine: normaliseText(source.cuisine),
    family: normaliseText(source.family),
    enabledOnly: source.enabledOnly === true,
    query: normaliseText(source.query).toLocaleLowerCase(),
  };
}

function matchesNonCategoryFilters(meal, filters) {
  if (filters.enabledOnly && meal.enabled !== true) return false;
  if (!filters.query) return true;
  return [meal.name, meal.dishType].some((value) => normaliseText(value).toLocaleLowerCase().includes(filters.query));
}

/** Filter meal references without changing or cloning the returned meal objects. */
export function filterMealsByCuisine(meals, filters = {}) {
  if (!Array.isArray(meals)) return [];
  const criteria = normaliseFilters(filters);
  return meals.filter((meal) => {
    if (!isRecord(meal)) return false;
    const normalised = normaliseCuisineFields(meal);
    return matchesNonCategoryFilters(normalised, criteria)
      && (!criteria.zone || normalised.cuisineZone === criteria.zone)
      && (!criteria.cuisine || normalised.cuisine === criteria.cuisine)
      && (!criteria.family || normalised.courseFamily === criteria.family);
  });
}

function sortedValues(meals, key) {
  return [...new Set(meals.map((meal) => meal[key]).filter(Boolean))].sort();
}

/**
 * Return populated cascading select choices. Zones are based on the current
 * non-category constraints; cuisines then honour zone, and families honour
 * both zone and cuisine.
 */
export function availableCuisineOptions(meals, filters = {}) {
  if (!Array.isArray(meals)) return { zones: [], cuisines: [], families: [] };
  const criteria = normaliseFilters(filters);
  const normalisedMeals = meals
    .filter(isRecord)
    .map(normaliseCuisineFields)
    .filter((meal) => matchesNonCategoryFilters(meal, criteria));
  const zoneMeals = criteria.zone
    ? normalisedMeals.filter((meal) => meal.cuisineZone === criteria.zone)
    : normalisedMeals;
  const cuisineMeals = criteria.cuisine
    ? zoneMeals.filter((meal) => meal.cuisine === criteria.cuisine)
    : zoneMeals;

  return {
    zones: sortedValues(normalisedMeals, 'cuisineZone'),
    cuisines: sortedValues(zoneMeals, 'cuisine'),
    families: sortedValues(cuisineMeals, 'courseFamily'),
  };
}
