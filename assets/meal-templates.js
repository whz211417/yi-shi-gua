import { DEFAULT_CUISINE_TAXONOMY } from './cuisine-catalog.js';

const BREAKFAST_DISH_TYPES = new Set([
  '虾饺', '烧卖', '肠粉', '汤包', '狗不理包子', '粘豆包', '煎饼果子', '咖椰吐司', '班尼迪克蛋',
]);
const SUPPLEMENT_DISH_TYPES = new Set([
  '港式奶茶', '珍珠奶茶', '糖油粑粑', '定胜糕', '鲜花饼', '绿豆糕', '菠萝油',
  '可丽露', '提拉米苏', '巴克拉瓦', '果蔬昔', '美式咖啡', '拿铁', '可颂', '贝果', '芝士蛋糕',
]);

function pathsInZone(cuisineZone) {
  return Object.entries(DEFAULT_CUISINE_TAXONOMY[cuisineZone]).flatMap(([cuisine, families]) => (
    Object.entries(families).flatMap(([courseFamily, dishTypes]) => (
      dishTypes.map((dishType) => ({ cuisineZone, cuisine, courseFamily, dishType }))
    ))
  ));
}

function allWorldPaths() {
  return Object.keys(DEFAULT_CUISINE_TAXONOMY)
    .filter((zone) => zone !== '中国菜')
    .flatMap(pathsInZone);
}

function label(path) { return `${path.courseFamily} ${path.dishType}`; }

function stableId(path, variant) {
  const raw = `${path.cuisineZone}|${path.cuisine}|${path.courseFamily}|${path.dishType}|${variant}`;
  let hash = 2166136261;
  for (const char of raw) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `meal-${(hash >>> 0).toString(36)}-${variant}`;
}

function stapleFor(path) {
  const text = label(path);
  if (/粥/.test(text)) return '粥类';
  if (/粉|米线|粿条|河粉|拉面|螺蛳|凉皮|肠旺/.test(text)) return '粉类';
  if (/面|饺|包|饼|馕|烧饼|煎饼|吐司|可颂|贝果|披萨|卷|塔可|汉堡|三明治|糕|粑粑/.test(text)) return '面食';
  return '米饭';
}

function proteinFor(path) {
  const text = label(path);
  if (/牛/.test(text)) return '牛肉';
  if (/鸡/.test(text)) return '鸡肉';
  if (/鱼|虾|海参|海蛎|蚝|鳗|章鱼/.test(text)) return '鱼虾';
  if (/鸭|鹅|猪|肉|排骨|肠|里脊|叉烧|腊/.test(text)) return '猪肉';
  if (/蛋/.test(text)) return '蛋类';
  if (/豆腐|天贝|豆|素|罗汉|菌菇|鹰嘴/.test(text)) return '豆制品';
  return '无明确蛋白';
}

function vegetableFor(path) {
  const text = label(path);
  if (SUPPLEMENT_DISH_TYPES.has(path.dishType)) return '无';
  if (/素|蔬|菌|沙拉|豆腐|时蔬|藜麦|果蔬/.test(text)) return '有';
  return '少';
}

function flavorFor(path) {
  const text = label(path);
  if (/汤|羹|粥|锅/.test(text)) return '汤类';
  if (/炸|煎|盐酥|虾饼|蚝烙/.test(text)) return '油炸';
  if (/麻辣|水煮|钵钵|孜然|辣|咖喱|烤/.test(text)) return '重口';
  if (/蒸|白切|清炖|清蒸|沙拉|素/.test(text)) return '清淡';
  return '普通';
}

function mealsFor(path) {
  return (BREAKFAST_DISH_TYPES.has(path.dishType) || SUPPLEMENT_DISH_TYPES.has(path.dishType)) ? ['早餐'] : ['午餐', '晚餐'];
}

function createTemplate(path, variant, { enabled, nameSuffix = '', overrides = {} }) {
  const isSupplement = SUPPLEMENT_DISH_TYPES.has(path.dishType);
  return {
    id: stableId(path, variant),
    name: `${path.cuisine}·${path.dishType}${nameSuffix}`,
    // Source is deliberately unconfirmed: users decide local availability in 整饬食单.
    source: '待确认',
    venue: '待确认模板',
    meals: mealsFor(path),
    staple: stapleFor(path),
    protein: proteinFor(path),
    vegetable: vegetableFor(path),
    flavor: flavorFor(path),
    enabled,
    availability: '待确认',
    isSupplement,
    cuisineZone: path.cuisineZone,
    cuisine: path.cuisine,
    courseFamily: path.courseFamily,
    dishType: path.dishType,
    ...overrides,
  };
}

const CHINESE_PATHS = pathsInZone('中国菜');
const WORLD_PATHS = allWorldPaths();

const EXTRA_CHINESE_VARIANTS = [
  { dishType: '宫保鸡丁', key: 'with-vegetables', suffix: '·配时蔬模板' },
  { dishType: '麻婆豆腐', key: 'with-rice', suffix: '·配米饭模板' },
  { dishType: '担担面', key: 'breakfast', suffix: '·早餐模板', breakfast: true },
  { dishType: '白切鸡', key: 'with-greens', suffix: '·配青菜模板' },
  { dishType: '肠粉', key: 'breakfast', suffix: '·早餐模板', breakfast: true },
  { dishType: '小炒肉', key: 'with-rice', suffix: '·配米饭模板' },
  { dishType: '湖南米粉', key: 'breakfast', suffix: '·早餐模板', breakfast: true },
  { dishType: '葱烧海参', key: 'with-rice', suffix: '·配米饭模板' },
  { dishType: '清炖狮子头', key: 'dinner', suffix: '·晚餐模板' },
  { dishType: '盐水鸭', key: 'with-vegetables', suffix: '·配时蔬模板' },
  { dishType: '龙井虾仁', key: 'with-rice', suffix: '·配米饭模板' },
  { dishType: '佛跳墙', key: 'banquet', suffix: '·宴席候选模板' },
  { dishType: '北京烤鸭', key: 'shared', suffix: '·聚餐候选模板' },
  { dishType: '锅包肉', key: 'with-rice', suffix: '·配米饭模板' },
  { dishType: '兰州牛肉面', key: 'lunch', suffix: '·午餐模板' },
  { dishType: '过桥米线', key: 'lunch', suffix: '·午餐模板' },
  { dishType: '潮汕牛肉火锅', key: 'shared', suffix: '·聚餐候选模板' },
  { dishType: '梅菜扣肉', key: 'with-vegetables', suffix: '·配时蔬模板' },
  { dishType: '钵钵鸡', key: 'malatang', suffix: '·麻辣烫候选模板' },
  { dishType: '紫菜蛋花汤', key: 'porridge-breakfast', suffix: '·配白粥早餐模板', porridgeBreakfast: true },
];

const pathByDishType = new Map(CHINESE_PATHS.map((path) => [path.dishType, path]));
const chineseBaseTemplates = CHINESE_PATHS.map((path) => createTemplate(path, 'base', { enabled: true }));
const chineseVariantTemplates = EXTRA_CHINESE_VARIANTS.map((variant) => {
  const path = pathByDishType.get(variant.dishType);
  if (!path) throw new Error(`缺少中国菜模板路径：${variant.dishType}`);
  const overrides = variant.porridgeBreakfast
    ? { meals: ['早餐'], staple: '粥类' }
    : (variant.breakfast ? { meals: ['早餐'] } : {});
  return createTemplate(path, `variant-${variant.key}`, {
    enabled: true,
    nameSuffix: variant.suffix,
    overrides,
  });
});
const worldCuisineTemplates = WORLD_PATHS.map((path) => createTemplate(path, 'base', { enabled: false }));

/**
 * Editable menu defaults. All templates are candidates, never claims of local supply.
 * Every object and its meals array is independently allocated for safe browser edits.
 */
export const MEAL_TEMPLATES = [
  ...chineseBaseTemplates,
  ...chineseVariantTemplates,
  ...worldCuisineTemplates,
];
