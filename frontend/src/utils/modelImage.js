/**
 * Resolve a catalog model image URL for menus / grids.
 * Backed by auto-generated MODEL_IMAGES from scripts/model-images/run.mjs
 */
export { MODEL_IMAGES, getModelImageUrl, modelImageStats } from '../config/modelImages';

export function modelImageAlt(brand, model) {
  return [brand, model].filter(Boolean).join(' ');
}
