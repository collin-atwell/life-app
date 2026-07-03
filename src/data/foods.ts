import type { FoodItem } from '../types';

// Seed food database. Real deployment would swap this for a 50k+ item API
// (e.g. USDA FoodData Central / Open Food Facts) behind the same FoodItem shape.
export const FOODS: FoodItem[] = [
  // Proteins
  { id: 'chicken-breast', name: 'Chicken Breast (grilled)', serving: '6 oz', calories: 280, protein: 53, carbs: 0, fat: 6, tags: ['balanced', 'high-protein', 'keto', 'carnivore'] },
  { id: 'chicken-thigh', name: 'Chicken Thigh (roasted)', serving: '6 oz', calories: 360, protein: 45, carbs: 0, fat: 19, tags: ['balanced', 'high-protein', 'keto', 'carnivore'] },
  { id: 'ground-beef-90', name: 'Ground Beef 90/10', serving: '6 oz', calories: 300, protein: 46, carbs: 0, fat: 12, tags: ['balanced', 'high-protein', 'keto', 'carnivore'] },
  { id: 'ribeye', name: 'Ribeye Steak', serving: '8 oz', calories: 620, protein: 54, carbs: 0, fat: 44, tags: ['keto', 'carnivore', 'high-protein'] },
  { id: 'salmon', name: 'Salmon Fillet', serving: '6 oz', calories: 350, protein: 38, carbs: 0, fat: 22, tags: ['balanced', 'high-protein', 'keto', 'carnivore'] },
  { id: 'tuna-can', name: 'Canned Tuna (in water)', serving: '1 can', calories: 120, protein: 27, carbs: 0, fat: 1, tags: ['balanced', 'high-protein', 'keto', 'carnivore'] },
  { id: 'shrimp', name: 'Shrimp', serving: '6 oz', calories: 170, protein: 34, carbs: 2, fat: 2, tags: ['balanced', 'high-protein', 'keto', 'carnivore'] },
  { id: 'eggs', name: 'Eggs (large)', serving: '2 eggs', calories: 140, protein: 12, carbs: 1, fat: 10, tags: ['balanced', 'high-protein', 'keto', 'carnivore', 'vegetarian'] },
  { id: 'egg-whites', name: 'Egg Whites', serving: '1 cup', calories: 125, protein: 26, carbs: 2, fat: 0, tags: ['balanced', 'high-protein', 'vegetarian'] },
  { id: 'whey', name: 'Whey Protein Scoop', serving: '1 scoop', calories: 120, protein: 24, carbs: 3, fat: 1.5, tags: ['balanced', 'high-protein', 'vegetarian'] },
  { id: 'greek-yogurt', name: 'Greek Yogurt (nonfat)', serving: '1 cup', calories: 130, protein: 23, carbs: 9, fat: 0, tags: ['balanced', 'high-protein', 'vegetarian'] },
  { id: 'cottage-cheese', name: 'Cottage Cheese (2%)', serving: '1 cup', calories: 180, protein: 24, carbs: 8, fat: 5, tags: ['balanced', 'high-protein', 'keto', 'vegetarian'] },
  { id: 'tofu', name: 'Tofu (firm)', serving: '1 cup', calories: 180, protein: 20, carbs: 4, fat: 11, tags: ['vegan', 'vegetarian', 'balanced'] },
  { id: 'tempeh', name: 'Tempeh', serving: '1 cup', calories: 320, protein: 34, carbs: 13, fat: 18, tags: ['vegan', 'vegetarian', 'high-protein'] },
  { id: 'seitan', name: 'Seitan', serving: '4 oz', calories: 160, protein: 28, carbs: 6, fat: 2, tags: ['vegan', 'vegetarian', 'high-protein'] },
  { id: 'lentils', name: 'Lentils (cooked)', serving: '1 cup', calories: 230, protein: 18, carbs: 40, fat: 1, tags: ['vegan', 'vegetarian', 'balanced'] },
  { id: 'black-beans', name: 'Black Beans (cooked)', serving: '1 cup', calories: 227, protein: 15, carbs: 41, fat: 1, tags: ['vegan', 'vegetarian', 'balanced'] },
  { id: 'chickpeas', name: 'Chickpeas (cooked)', serving: '1 cup', calories: 269, protein: 15, carbs: 45, fat: 4, tags: ['vegan', 'vegetarian', 'balanced'] },
  { id: 'pea-protein', name: 'Pea Protein Scoop', serving: '1 scoop', calories: 120, protein: 24, carbs: 2, fat: 2, tags: ['vegan', 'vegetarian', 'high-protein'] },
  { id: 'turkey-breast', name: 'Turkey Breast (roasted)', serving: '6 oz', calories: 250, protein: 51, carbs: 0, fat: 4, tags: ['balanced', 'high-protein', 'keto', 'carnivore'] },
  { id: 'pork-chop', name: 'Pork Chop (lean)', serving: '6 oz', calories: 340, protein: 44, carbs: 0, fat: 17, tags: ['balanced', 'high-protein', 'keto', 'carnivore'] },

  // Carbs
  { id: 'white-rice', name: 'White Rice (cooked)', serving: '1 cup', calories: 205, protein: 4, carbs: 45, fat: 0, tags: ['balanced', 'vegan', 'vegetarian'] },
  { id: 'brown-rice', name: 'Brown Rice (cooked)', serving: '1 cup', calories: 218, protein: 5, carbs: 46, fat: 2, tags: ['balanced', 'vegan', 'vegetarian'] },
  { id: 'oats', name: 'Oatmeal (dry)', serving: '1/2 cup', calories: 150, protein: 5, carbs: 27, fat: 3, tags: ['balanced', 'vegan', 'vegetarian'] },
  { id: 'sweet-potato', name: 'Sweet Potato', serving: '1 medium', calories: 112, protein: 2, carbs: 26, fat: 0, tags: ['balanced', 'vegan', 'vegetarian'] },
  { id: 'potato', name: 'Russet Potato (baked)', serving: '1 medium', calories: 168, protein: 5, carbs: 37, fat: 0, tags: ['balanced', 'vegan', 'vegetarian'] },
  { id: 'pasta', name: 'Pasta (cooked)', serving: '1 cup', calories: 220, protein: 8, carbs: 43, fat: 1, tags: ['balanced', 'vegan', 'vegetarian'] },
  { id: 'quinoa', name: 'Quinoa (cooked)', serving: '1 cup', calories: 222, protein: 8, carbs: 39, fat: 4, tags: ['balanced', 'vegan', 'vegetarian'] },
  { id: 'bread-ww', name: 'Whole Wheat Bread', serving: '2 slices', calories: 160, protein: 8, carbs: 28, fat: 2, tags: ['balanced', 'vegan', 'vegetarian'] },
  { id: 'bagel', name: 'Plain Bagel', serving: '1 bagel', calories: 280, protein: 11, carbs: 56, fat: 1.5, tags: ['balanced', 'vegan', 'vegetarian'] },
  { id: 'tortilla', name: 'Flour Tortilla (large)', serving: '1 tortilla', calories: 140, protein: 4, carbs: 24, fat: 3.5, tags: ['balanced', 'vegan', 'vegetarian'] },
  { id: 'banana', name: 'Banana', serving: '1 medium', calories: 105, protein: 1, carbs: 27, fat: 0, tags: ['balanced', 'vegan', 'vegetarian'] },
  { id: 'apple', name: 'Apple', serving: '1 medium', calories: 95, protein: 0, carbs: 25, fat: 0, tags: ['balanced', 'vegan', 'vegetarian'] },
  { id: 'berries', name: 'Mixed Berries', serving: '1 cup', calories: 70, protein: 1, carbs: 17, fat: 0, tags: ['balanced', 'vegan', 'vegetarian', 'keto'] },
  { id: 'orange', name: 'Orange', serving: '1 medium', calories: 62, protein: 1, carbs: 15, fat: 0, tags: ['balanced', 'vegan', 'vegetarian'] },

  // Fats
  { id: 'avocado', name: 'Avocado', serving: '1/2 fruit', calories: 120, protein: 1.5, carbs: 6, fat: 11, tags: ['balanced', 'vegan', 'vegetarian', 'keto'] },
  { id: 'peanut-butter', name: 'Peanut Butter', serving: '2 tbsp', calories: 190, protein: 8, carbs: 7, fat: 16, tags: ['balanced', 'vegan', 'vegetarian', 'keto'] },
  { id: 'almonds', name: 'Almonds', serving: '1 oz (23)', calories: 164, protein: 6, carbs: 6, fat: 14, tags: ['balanced', 'vegan', 'vegetarian', 'keto'] },
  { id: 'olive-oil', name: 'Olive Oil', serving: '1 tbsp', calories: 119, protein: 0, carbs: 0, fat: 14, tags: ['balanced', 'vegan', 'vegetarian', 'keto', 'carnivore'] },
  { id: 'butter', name: 'Butter', serving: '1 tbsp', calories: 102, protein: 0, carbs: 0, fat: 12, tags: ['keto', 'carnivore', 'vegetarian'] },
  { id: 'cheese-cheddar', name: 'Cheddar Cheese', serving: '1 oz', calories: 114, protein: 7, carbs: 0, fat: 9, tags: ['keto', 'carnivore', 'vegetarian', 'balanced'] },
  { id: 'chia', name: 'Chia Seeds', serving: '2 tbsp', calories: 138, protein: 5, carbs: 12, fat: 9, tags: ['vegan', 'vegetarian', 'keto', 'balanced'] },

  // Veggies
  { id: 'broccoli', name: 'Broccoli (steamed)', serving: '1 cup', calories: 55, protein: 4, carbs: 11, fat: 0, tags: ['balanced', 'vegan', 'vegetarian', 'keto'] },
  { id: 'spinach', name: 'Spinach (raw)', serving: '2 cups', calories: 14, protein: 2, carbs: 2, fat: 0, tags: ['balanced', 'vegan', 'vegetarian', 'keto'] },
  { id: 'mixed-greens-salad', name: 'Mixed Greens Salad', serving: '2 cups', calories: 20, protein: 2, carbs: 4, fat: 0, tags: ['balanced', 'vegan', 'vegetarian', 'keto'] },
  { id: 'asparagus', name: 'Asparagus', serving: '1 cup', calories: 27, protein: 3, carbs: 5, fat: 0, tags: ['balanced', 'vegan', 'vegetarian', 'keto'] },
  { id: 'bell-pepper', name: 'Bell Pepper', serving: '1 medium', calories: 25, protein: 1, carbs: 6, fat: 0, tags: ['balanced', 'vegan', 'vegetarian', 'keto'] },
  { id: 'carrots', name: 'Carrots', serving: '1 cup', calories: 52, protein: 1, carbs: 12, fat: 0, tags: ['balanced', 'vegan', 'vegetarian'] },

  // Meals / composites
  { id: 'protein-smoothie', name: 'Protein Smoothie (whey, banana, PB)', serving: '1 smoothie', calories: 415, protein: 33, carbs: 41, fat: 17, tags: ['balanced', 'high-protein', 'vegetarian'] },
  { id: 'chicken-rice-bowl', name: 'Chicken & Rice Bowl', serving: '1 bowl', calories: 540, protein: 57, carbs: 50, fat: 10, tags: ['balanced', 'high-protein'] },
  { id: 'burrito-bowl', name: 'Burrito Bowl (chicken)', serving: '1 bowl', calories: 650, protein: 45, carbs: 65, fat: 22, tags: ['balanced', 'high-protein'] },
  { id: 'pb-toast', name: 'PB Banana Toast', serving: '2 slices', calories: 455, protein: 13, carbs: 62, fat: 19, tags: ['balanced', 'vegan', 'vegetarian'] },
  { id: 'overnight-oats', name: 'Overnight Oats w/ Berries', serving: '1 jar', calories: 350, protein: 15, carbs: 55, fat: 8, tags: ['balanced', 'vegetarian'] },
  { id: 'tofu-stirfry', name: 'Tofu Veggie Stir-Fry + Rice', serving: '1 plate', calories: 520, protein: 26, carbs: 62, fat: 18, tags: ['vegan', 'vegetarian', 'balanced'] },
  { id: 'salmon-plate', name: 'Salmon, Sweet Potato & Greens', serving: '1 plate', calories: 490, protein: 41, carbs: 30, fat: 22, tags: ['balanced', 'high-protein'] },
  { id: 'steak-eggs', name: 'Steak & Eggs', serving: '1 plate', calories: 560, protein: 51, carbs: 1, fat: 38, tags: ['keto', 'carnivore', 'high-protein'] },
  { id: 'lentil-curry', name: 'Lentil Curry + Rice', serving: '1 bowl', calories: 560, protein: 22, carbs: 90, fat: 12, tags: ['vegan', 'vegetarian', 'balanced'] },
  { id: 'turkey-sandwich', name: 'Turkey Sandwich', serving: '1 sandwich', calories: 380, protein: 30, carbs: 40, fat: 11, tags: ['balanced', 'high-protein'] },
  { id: 'protein-bar', name: 'Protein Bar', serving: '1 bar', calories: 210, protein: 20, carbs: 22, fat: 7, tags: ['balanced', 'high-protein', 'vegetarian'] },
  { id: 'trail-mix', name: 'Trail Mix', serving: '1/4 cup', calories: 175, protein: 5, carbs: 16, fat: 11, tags: ['balanced', 'vegan', 'vegetarian'] },
  { id: 'rice-cakes-pb', name: 'Rice Cakes + PB', serving: '2 cakes', calories: 260, protein: 9, carbs: 22, fat: 16, tags: ['balanced', 'vegan', 'vegetarian'] },
];

export const FOOD_MAP: Record<string, FoodItem> = Object.fromEntries(FOODS.map(f => [f.id, f]));
