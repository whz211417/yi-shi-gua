import { DEFAULT_CUISINE_TAXONOMY } from './cuisine-catalog.js';

const MEAL_PERIODS = ['早餐', '午餐', '晚餐'];
const FALLBACK_PROTEINS = ['鸡肉', '牛肉', '猪肉', '鱼虾', '蛋类', '豆制品', '无明确蛋白'];

function pathsInZone(cuisineZone) {
  return Object.entries(DEFAULT_CUISINE_TAXONOMY[cuisineZone]).flatMap(([cuisine, families]) => (
    Object.entries(families).flatMap(([courseFamily, dishTypes]) => (
      dishTypes.map((dishType) => ({ cuisineZone, cuisine, courseFamily, dishType }))
    ))
  ));
}

function worldPaths() {
  return Object.entries(DEFAULT_CUISINE_TAXONOMY)
    .filter(([cuisineZone]) => cuisineZone !== '中国菜')
    .flatMap(([cuisineZone]) => pathsInZone(cuisineZone));
}

function stapleFor(path, index) {
  const label = `${path.courseFamily}${path.dishType}`;
  if (/粥/.test(label)) return '粥类';
  if (/粉|米线|粿条|河粉|拉面|螺蛳|凉皮|肠旺/.test(label)) return '粉类';
  if (/面|饺|包|饼|馕|烧饼|煎饼|吐司|可颂|贝果|披萨|卷|塔可|汉堡|三明治|糕|粑粑/.test(label)) return '面食';
  return index % 5 === 0 ? '面食' : '米饭';
}

function proteinFor(path, index) {
  const label = `${path.courseFamily}${path.dishType}`;
  if (/牛/.test(label)) return '牛肉';
  if (/鸡/.test(label)) return '鸡肉';
  if (/鱼|虾|海参|海蛎|蚝|鳗|章鱼/.test(label)) return '鱼虾';
  if (/鸭|鹅|猪|肉|排骨|肠|里脊|叉烧|腊/.test(label)) return '猪肉';
  if (/蛋/.test(label)) return '蛋类';
  if (/豆腐|天贝|豆|素|罗汉|菌菇|鹰嘴/.test(label)) return '豆制品';
  return FALLBACK_PROTEINS[index % FALLBACK_PROTEINS.length];
}

function vegetableFor(path, index) {
  const label = `${path.courseFamily}${path.dishType}`;
  if (/甜品|饮品|咖啡|烘焙|糕|奶茶|咖啡|可颂|贝果|巴克拉瓦/.test(label)) return '无';
  if (/素|蔬|菌|沙拉|豆腐|时蔬|藜麦|果蔬/.test(label)) return '有';
  return index % 4 === 0 ? '少' : '有';
}

function flavorFor(path, index) {
  const label = `${path.courseFamily}${path.dishType}`;
  if (/汤|羹|粥|锅/.test(label)) return '汤类';
  if (/炸|煎|盐酥|虾饼|蚝烙/.test(label)) return '油炸';
  if (/麻辣|水煮|钵钵|孜然|辣|咖喱|烤/.test(label)) return '重口';
  return index % 3 === 0 ? '清淡' : '普通';
}

function createTemplate(path, index, { enabled, source, venue, nameSuffix = '' } = {}) {
  return {
    id: `${path.cuisineZone === '中国菜' ? 'cn' : 'world'}-${String(index + 1).padStart(3, '0')}`,
    name: `${path.cuisine}·${path.dishType}${nameSuffix}`,
    source,
    venue,
    meals: [MEAL_PERIODS[index % MEAL_PERIODS.length]],
    staple: stapleFor(path, index),
    protein: proteinFor(path, index),
    vegetable: vegetableFor(path, index),
    flavor: flavorFor(path, index),
    enabled,
    cuisineZone: path.cuisineZone,
    cuisine: path.cuisine,
    courseFamily: path.courseFamily,
    dishType: path.dishType,
  };
}

const CHINESE_PATHS = pathsInZone('中国菜');
const WORLD_PATHS = worldPaths();

const chineseBaseTemplates = CHINESE_PATHS.map((path, index) => {
  const template = createTemplate(path, index, {
    enabled: true,
    source: index % 4 === 0 ? '校外' : '食堂',
    venue: index % 4 === 0 ? '校外模板' : '校园食堂模板',
  });
  if (path.cuisine === '中式日常' && path.dishType === '紫菜蛋花汤') {
    return { ...template, name: '中式日常·紫菜蛋花汤·粥类早餐模板', meals: ['早餐'], staple: '粥类' };
  }
  return template;
});

// A second, editable venue layer supplies distinct templates without duplicating
// ids, names, or mutable meal-period arrays. It includes the 四川小吃 path as a
// 麻辣烫-style template while retaining its catalog dish type.
const EXTRA_CHINESE_PATHS = [
  ...CHINESE_PATHS.filter(({ dishType }) => dishType === '钵钵鸡'),
  ...CHINESE_PATHS.filter(({ dishType }) => dishType !== '钵钵鸡').slice(0, 18),
];
const chineseVenueTemplates = EXTRA_CHINESE_PATHS.map((path, index) => createTemplate(path, CHINESE_PATHS.length + index, {
  enabled: true,
  source: '校外',
  venue: '校外模板',
  nameSuffix: index === 0 ? '·麻辣烫模板（钵钵鸡）' : '（校外模板）',
}));

const worldCuisineTemplates = WORLD_PATHS.map((path, index) => createTemplate(path, index, {
  enabled: false,
  source: '校外',
  venue: '世界料理模板',
}));

/**
 * Editable, standalone menu defaults for the staged menu-library integration.
 * Each object and its `meals` array is independently allocated for safe edits.
 */
export const MEAL_TEMPLATES = [
  ...chineseBaseTemplates,
  ...chineseVenueTemplates,
  ...worldCuisineTemplates,
];
