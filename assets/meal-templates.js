import { DEFAULT_CUISINE_TAXONOMY } from './cuisine-catalog.js';

const BREAKFAST_ONLY = /咖啡|奶茶|甜品|糕|果蔬昔|菠萝油|绿豆糕|可丽露|提拉米苏|巴克拉瓦|可颂|贝果|松饼|咖椰吐司|班尼迪克蛋|点心|小吃|包子|烧饼|煎饼|粥/;
const SUPPLEMENT = /咖啡|奶茶|甜品|糕|果蔬昔|菠萝油|绿豆糕|可丽露|提拉米苏|巴克拉瓦/;

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
  if (SUPPLEMENT.test(text)) return '无';
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
  return BREAKFAST_ONLY.test(label(path)) ? ['早餐'] : ['午餐', '晚餐'];
}

function createTemplate(path, variant, { enabled, nameSuffix = '', overrides = {} }) {
  const isSupplement = SUPPLEMENT.test(label(path));
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
  ['宫保鸡丁', '·配时蔬模板'], ['麻婆豆腐', '·配米饭模板'], ['担担面', '·早餐模板'],
  ['白切鸡', '·配青菜模板'], ['肠粉', '·早餐模板'], ['小炒肉', '·配米饭模板'],
  ['湖南米粉', '·早餐模板'], ['葱烧海参', '·配米饭模板'], ['清炖狮子头', '·晚餐模板'],
  ['盐水鸭', '·配时蔬模板'], ['龙井虾仁', '·配米饭模板'], ['佛跳墙', '·宴席候选模板'],
  ['北京烤鸭', '·聚餐候选模板'], ['锅包肉', '·配米饭模板'], ['兰州牛肉面', '·午餐模板'],
  ['过桥米线', '·午餐模板'], ['潮汕牛肉火锅', '·聚餐候选模板'], ['梅菜扣肉', '·配时蔬模板'],
  ['钵钵鸡', '·麻辣烫候选模板'], ['紫菜蛋花汤', '·配白粥早餐模板'],
];

const pathByDishType = new Map(CHINESE_PATHS.map((path) => [path.dishType, path]));
const chineseBaseTemplates = CHINESE_PATHS.map((path) => createTemplate(path, 'base', { enabled: true }));
const chineseVariantTemplates = EXTRA_CHINESE_VARIANTS.map(([dishType, nameSuffix], index) => {
  const path = pathByDishType.get(dishType);
  if (!path) throw new Error(`缺少中国菜模板路径：${dishType}`);
  const breakfast = /早餐/.test(nameSuffix);
  const porridgeBreakfast = dishType === '紫菜蛋花汤';
  return createTemplate(path, `variant-${index + 1}`, {
    enabled: true,
    nameSuffix,
    overrides: porridgeBreakfast ? { meals: ['早餐'], staple: '粥类' } : (breakfast ? { meals: ['早餐'] } : {}),
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
