import type { Exercise } from '../types';

const yt = (q: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q + ' proper form')}`;

// Seed library — 60+ exercises across all muscle groups and equipment types.
export const EXERCISES: Exercise[] = [
  // ----- Chest -----
  { id: 'bench-press', name: 'Barbell Bench Press', primary: ['chest'], secondary: ['triceps', 'shoulders'], equipment: ['barbell', 'bench'], cues: 'Retract shoulder blades, feet planted, bar to mid-chest, drive up in a slight arc.', videoUrl: yt('barbell bench press') },
  { id: 'db-bench', name: 'Dumbbell Bench Press', primary: ['chest'], secondary: ['triceps', 'shoulders'], equipment: ['dumbbells', 'bench'], cues: 'Keep wrists stacked over elbows; lower to chest level with control.', videoUrl: yt('dumbbell bench press') },
  { id: 'incline-db-press', name: 'Incline Dumbbell Press', primary: ['chest', 'shoulders'], secondary: ['triceps'], equipment: ['dumbbells', 'bench'], cues: '30-45° incline; press up and slightly back.', videoUrl: yt('incline dumbbell press') },
  { id: 'pushup', name: 'Push-Up', primary: ['chest'], secondary: ['triceps', 'core'], equipment: ['bodyweight'], cues: 'Body in straight line, hands under shoulders, full range of motion.', videoUrl: yt('push up') },
  { id: 'dips', name: 'Dips', primary: ['chest', 'triceps'], secondary: ['shoulders'], equipment: ['bodyweight'], cues: 'Lean forward for chest emphasis; keep shoulders down away from ears.', videoUrl: yt('chest dips') },
  { id: 'cable-fly', name: 'Cable Fly', primary: ['chest'], secondary: [], equipment: ['cables'], cues: 'Slight elbow bend held constant; squeeze at midline.', videoUrl: yt('cable fly') },
  { id: 'machine-chest-press', name: 'Machine Chest Press', primary: ['chest'], secondary: ['triceps'], equipment: ['machines'], cues: 'Adjust seat so handles align with mid-chest.', videoUrl: yt('machine chest press') },
  { id: 'db-fly', name: 'Dumbbell Fly', primary: ['chest'], secondary: [], equipment: ['dumbbells', 'bench'], cues: 'Wide arc, stretch at the bottom, do not overload.', videoUrl: yt('dumbbell fly') },

  // ----- Back -----
  { id: 'deadlift', name: 'Barbell Deadlift', primary: ['back', 'hamstrings', 'glutes'], secondary: ['forearms', 'core'], equipment: ['barbell'], cues: 'Neutral spine, bar over midfoot, push floor away, lock out with glutes.', videoUrl: yt('barbell deadlift') },
  { id: 'pullup', name: 'Pull-Up', primary: ['back'], secondary: ['biceps', 'forearms'], equipment: ['pull-up bar', 'bodyweight'], cues: 'Full hang to chin over bar; drive elbows down and back.', videoUrl: yt('pull up') },
  { id: 'chinup', name: 'Chin-Up', primary: ['back', 'biceps'], secondary: ['forearms'], equipment: ['pull-up bar', 'bodyweight'], cues: 'Supinated grip; keep core tight, avoid kipping.', videoUrl: yt('chin up') },
  { id: 'bb-row', name: 'Barbell Row', primary: ['back'], secondary: ['biceps', 'core'], equipment: ['barbell'], cues: 'Hinge to ~45°, pull bar to lower ribs, control the descent.', videoUrl: yt('barbell row') },
  { id: 'db-row', name: 'One-Arm Dumbbell Row', primary: ['back'], secondary: ['biceps'], equipment: ['dumbbells', 'bench'], cues: 'Flat back, pull to hip, avoid torso rotation.', videoUrl: yt('one arm dumbbell row') },
  { id: 'lat-pulldown', name: 'Lat Pulldown', primary: ['back'], secondary: ['biceps'], equipment: ['cables', 'machines'], cues: 'Pull to upper chest, slight lean back, no momentum.', videoUrl: yt('lat pulldown') },
  { id: 'seated-cable-row', name: 'Seated Cable Row', primary: ['back'], secondary: ['biceps'], equipment: ['cables'], cues: 'Chest tall; squeeze shoulder blades together at the back.', videoUrl: yt('seated cable row') },
  { id: 'band-pull-apart', name: 'Band Pull-Apart', primary: ['back', 'shoulders'], secondary: [], equipment: ['bands'], cues: 'Arms straight, pull band to chest, control return.', videoUrl: yt('band pull apart') },
  { id: 'inverted-row', name: 'Inverted Row', primary: ['back'], secondary: ['biceps', 'core'], equipment: ['bodyweight', 'barbell'], cues: 'Body rigid, pull chest to bar.', videoUrl: yt('inverted row') },

  // ----- Shoulders -----
  { id: 'ohp', name: 'Overhead Press', primary: ['shoulders'], secondary: ['triceps', 'core'], equipment: ['barbell'], cues: 'Squeeze glutes, press bar overhead in line with ears, lock out.', videoUrl: yt('overhead press') },
  { id: 'db-shoulder-press', name: 'Dumbbell Shoulder Press', primary: ['shoulders'], secondary: ['triceps'], equipment: ['dumbbells'], cues: 'Neutral or pronated grip; avoid excessive lower-back arch.', videoUrl: yt('dumbbell shoulder press') },
  { id: 'lateral-raise', name: 'Lateral Raise', primary: ['shoulders'], secondary: [], equipment: ['dumbbells', 'cables'], cues: 'Lead with elbows, slight forward lean, stop at shoulder height.', videoUrl: yt('lateral raise') },
  { id: 'face-pull', name: 'Face Pull', primary: ['shoulders', 'back'], secondary: [], equipment: ['cables', 'bands'], cues: 'Pull to face with external rotation; great for posture.', videoUrl: yt('face pull') },
  { id: 'rear-delt-fly', name: 'Rear Delt Fly', primary: ['shoulders'], secondary: ['back'], equipment: ['dumbbells', 'machines'], cues: 'Hinge forward, lead with pinkies, light weight high reps.', videoUrl: yt('rear delt fly') },
  { id: 'pike-pushup', name: 'Pike Push-Up', primary: ['shoulders'], secondary: ['triceps'], equipment: ['bodyweight'], cues: 'Hips high, head toward floor between hands.', videoUrl: yt('pike push up') },

  // ----- Arms -----
  { id: 'bb-curl', name: 'Barbell Curl', primary: ['biceps'], secondary: ['forearms'], equipment: ['barbell'], cues: 'Elbows pinned to sides; no swinging.', videoUrl: yt('barbell curl') },
  { id: 'db-curl', name: 'Dumbbell Curl', primary: ['biceps'], secondary: ['forearms'], equipment: ['dumbbells'], cues: 'Supinate as you curl; full extension at bottom.', videoUrl: yt('dumbbell curl') },
  { id: 'hammer-curl', name: 'Hammer Curl', primary: ['biceps', 'forearms'], secondary: [], equipment: ['dumbbells'], cues: 'Neutral grip throughout; targets brachialis.', videoUrl: yt('hammer curl') },
  { id: 'tricep-pushdown', name: 'Tricep Pushdown', primary: ['triceps'], secondary: [], equipment: ['cables'], cues: 'Elbows fixed, full lockout, squeeze at bottom.', videoUrl: yt('tricep pushdown') },
  { id: 'skullcrusher', name: 'Skull Crusher', primary: ['triceps'], secondary: [], equipment: ['barbell', 'dumbbells', 'bench'], cues: 'Lower to forehead/behind head, elbows stationary.', videoUrl: yt('skull crusher') },
  { id: 'ohte', name: 'Overhead Tricep Extension', primary: ['triceps'], secondary: [], equipment: ['dumbbells', 'cables'], cues: 'Elbows close to head, deep stretch at bottom.', videoUrl: yt('overhead tricep extension') },
  { id: 'wrist-curl', name: 'Wrist Curl', primary: ['forearms'], secondary: [], equipment: ['dumbbells', 'barbell'], cues: 'Forearms supported; small controlled range.', videoUrl: yt('wrist curl') },
  { id: 'dead-hang', name: 'Dead Hang', primary: ['forearms'], secondary: ['back', 'shoulders'], equipment: ['pull-up bar'], cues: 'Active shoulders; great grip work for climbers.', videoUrl: yt('dead hang') },

  // ----- Legs -----
  { id: 'squat', name: 'Barbell Back Squat', primary: ['quads', 'glutes'], secondary: ['hamstrings', 'core'], equipment: ['barbell'], cues: 'Brace hard, knees track toes, hit depth, drive through midfoot.', videoUrl: yt('barbell back squat') },
  { id: 'front-squat', name: 'Front Squat', primary: ['quads'], secondary: ['glutes', 'core'], equipment: ['barbell'], cues: 'Elbows high, upright torso, sit straight down.', videoUrl: yt('front squat') },
  { id: 'goblet-squat', name: 'Goblet Squat', primary: ['quads', 'glutes'], secondary: ['core'], equipment: ['dumbbells', 'kettlebell'], cues: 'Hold weight at chest, elbows inside knees at bottom.', videoUrl: yt('goblet squat') },
  { id: 'rdl', name: 'Romanian Deadlift', primary: ['hamstrings', 'glutes'], secondary: ['back'], equipment: ['barbell', 'dumbbells'], cues: 'Soft knees, push hips back, feel hamstring stretch, flat back.', videoUrl: yt('romanian deadlift') },
  { id: 'lunge', name: 'Walking Lunge', primary: ['quads', 'glutes'], secondary: ['hamstrings', 'core'], equipment: ['bodyweight', 'dumbbells'], cues: 'Long stride, back knee kisses floor, push through front heel.', videoUrl: yt('walking lunge') },
  { id: 'bulgarian-split-squat', name: 'Bulgarian Split Squat', primary: ['quads', 'glutes'], secondary: ['hamstrings'], equipment: ['dumbbells', 'bench', 'bodyweight'], cues: 'Rear foot elevated; keep front shin near vertical.', videoUrl: yt('bulgarian split squat') },
  { id: 'leg-press', name: 'Leg Press', primary: ['quads', 'glutes'], secondary: ['hamstrings'], equipment: ['machines'], cues: 'Feet shoulder width; do not lock knees hard at top.', videoUrl: yt('leg press') },
  { id: 'leg-curl', name: 'Leg Curl', primary: ['hamstrings'], secondary: [], equipment: ['machines'], cues: 'Control the eccentric; full range.', videoUrl: yt('leg curl') },
  { id: 'leg-extension', name: 'Leg Extension', primary: ['quads'], secondary: [], equipment: ['machines'], cues: 'Pause at the top; avoid slamming the stack.', videoUrl: yt('leg extension') },
  { id: 'hip-thrust', name: 'Hip Thrust', primary: ['glutes'], secondary: ['hamstrings'], equipment: ['barbell', 'bench'], cues: 'Chin tucked, posterior pelvic tilt at lockout, squeeze hard.', videoUrl: yt('hip thrust') },
  { id: 'calf-raise', name: 'Standing Calf Raise', primary: ['calves'], secondary: [], equipment: ['bodyweight', 'dumbbells', 'machines'], cues: 'Full stretch at bottom, pause at top.', videoUrl: yt('standing calf raise') },
  { id: 'box-jump', name: 'Box Jump', primary: ['quads', 'glutes'], secondary: ['calves', 'core'], equipment: ['box'], cues: 'Land soft in quarter squat; step down, don\'t jump down.', videoUrl: yt('box jump') },
  { id: 'kb-swing', name: 'Kettlebell Swing', primary: ['glutes', 'hamstrings'], secondary: ['core', 'back'], equipment: ['kettlebell'], cues: 'Hip hinge, not a squat; snap hips, float the bell.', videoUrl: yt('kettlebell swing') },
  { id: 'pistol-squat', name: 'Pistol Squat', primary: ['quads', 'glutes'], secondary: ['core'], equipment: ['bodyweight'], cues: 'Counterbalance with arms; scale with a box.', videoUrl: yt('pistol squat') },
  { id: 'step-up', name: 'Step-Up', primary: ['quads', 'glutes'], secondary: [], equipment: ['box', 'dumbbells', 'bodyweight'], cues: 'Drive through the top foot; minimize push-off from the floor leg.', videoUrl: yt('dumbbell step up') },

  // ----- Core -----
  { id: 'plank', name: 'Plank', primary: ['core'], secondary: ['shoulders'], equipment: ['bodyweight'], cues: 'Squeeze glutes, ribs down, straight line head to heels.', videoUrl: yt('plank') },
  { id: 'side-plank', name: 'Side Plank', primary: ['core'], secondary: ['shoulders'], equipment: ['bodyweight'], cues: 'Stack shoulders/hips; push floor away.', videoUrl: yt('side plank') },
  { id: 'hanging-leg-raise', name: 'Hanging Leg Raise', primary: ['core'], secondary: ['forearms'], equipment: ['pull-up bar'], cues: 'Posterior tilt pelvis; avoid swinging.', videoUrl: yt('hanging leg raise') },
  { id: 'ab-wheel', name: 'Ab Wheel Rollout', primary: ['core'], secondary: ['shoulders'], equipment: ['bodyweight'], cues: 'Hollow body; extend only as far as you can control.', videoUrl: yt('ab wheel rollout') },
  { id: 'russian-twist', name: 'Russian Twist', primary: ['core'], secondary: [], equipment: ['bodyweight', 'dumbbells', 'kettlebell'], cues: 'Rotate from the torso, not the arms.', videoUrl: yt('russian twist') },
  { id: 'deadbug', name: 'Dead Bug', primary: ['core'], secondary: [], equipment: ['bodyweight'], cues: 'Low back pressed to floor throughout.', videoUrl: yt('dead bug') },
  { id: 'cable-crunch', name: 'Cable Crunch', primary: ['core'], secondary: [], equipment: ['cables'], cues: 'Flex the spine, hips stay still.', videoUrl: yt('cable crunch') },
  { id: 'mountain-climber', name: 'Mountain Climber', primary: ['core'], secondary: ['shoulders', 'quads'], equipment: ['bodyweight'], cues: 'Hips level, quick knee drive.', videoUrl: yt('mountain climber') },

  // ----- Conditioning / full body -----
  { id: 'burpee', name: 'Burpee', primary: ['full-body'], secondary: ['chest', 'quads', 'core'], equipment: ['bodyweight'], cues: 'Chest to floor, full hip extension with jump at top.', videoUrl: yt('burpee') },
  { id: 'thruster', name: 'Thruster', primary: ['full-body'], secondary: ['quads', 'shoulders'], equipment: ['barbell', 'dumbbells'], cues: 'Front squat directly into overhead press; one fluid motion.', videoUrl: yt('thruster') },
  { id: 'clean-press', name: 'Clean and Press', primary: ['full-body'], secondary: ['shoulders', 'glutes', 'back'], equipment: ['barbell', 'dumbbells', 'kettlebell'], cues: 'Explosive hip drive; catch in rack, then press.', videoUrl: yt('clean and press') },
  { id: 'row-erg', name: 'Rowing (Erg)', primary: ['full-body'], secondary: ['back', 'quads'], equipment: ['rower'], cues: 'Legs → hips → arms on the drive; reverse on recovery.', videoUrl: yt('rowing machine technique') },
  { id: 'farmer-carry', name: "Farmer's Carry", primary: ['forearms', 'core'], secondary: ['full-body'], equipment: ['dumbbells', 'kettlebell'], cues: 'Tall posture, tight core, controlled steps.', videoUrl: yt('farmers carry') },
  { id: 'wall-ball', name: 'Wall Ball', primary: ['full-body'], secondary: ['quads', 'shoulders'], equipment: ['bodyweight'], cues: 'Squat depth then explosive throw to target.', videoUrl: yt('wall ball') },
  { id: 'jump-rope', name: 'Jump Rope', primary: ['calves'], secondary: ['full-body'], equipment: ['bodyweight'], cues: 'Small hops, wrists do the work.', videoUrl: yt('jump rope basics') },
  { id: 'sled-treadmill', name: 'Incline Treadmill Walk', primary: ['full-body'], secondary: ['calves', 'glutes'], equipment: ['treadmill'], cues: 'No holding the rails; steady zone-2 pace.', videoUrl: yt('incline treadmill walking') },
];

export const EXERCISE_MAP: Record<string, Exercise> = Object.fromEntries(EXERCISES.map(e => [e.id, e]));

export const MUSCLE_GROUPS: { id: string; label: string }[] = [
  { id: 'chest', label: 'Chest' }, { id: 'back', label: 'Back' }, { id: 'shoulders', label: 'Shoulders' },
  { id: 'biceps', label: 'Biceps' }, { id: 'triceps', label: 'Triceps' }, { id: 'forearms', label: 'Forearms' },
  { id: 'quads', label: 'Quads' }, { id: 'hamstrings', label: 'Hamstrings' }, { id: 'glutes', label: 'Glutes' },
  { id: 'calves', label: 'Calves' }, { id: 'core', label: 'Core' }, { id: 'full-body', label: 'Full Body' },
];

export const ALL_EQUIPMENT = [
  'bodyweight', 'dumbbells', 'barbell', 'kettlebell', 'cables', 'machines',
  'bands', 'pull-up bar', 'bench', 'box', 'rower', 'treadmill',
] as const;

// Stretch/mobility suggestions per muscle group, used by the Recovery module.
export const STRETCHES: Record<string, { name: string; videoUrl: string }[]> = {
  chest: [{ name: 'Doorway Pec Stretch', videoUrl: yt('doorway pec stretch') }, { name: 'Foam Roll Pecs', videoUrl: yt('foam roll chest') }],
  back: [{ name: "Child's Pose", videoUrl: yt('childs pose stretch') }, { name: 'Foam Roll Lats', videoUrl: yt('foam roll lats') }],
  shoulders: [{ name: 'Cross-Body Shoulder Stretch', videoUrl: yt('cross body shoulder stretch') }, { name: 'Thread the Needle', videoUrl: yt('thread the needle stretch') }],
  biceps: [{ name: 'Wall Bicep Stretch', videoUrl: yt('wall bicep stretch') }],
  triceps: [{ name: 'Overhead Tricep Stretch', videoUrl: yt('overhead tricep stretch') }],
  forearms: [{ name: 'Wrist Flexor Stretch', videoUrl: yt('wrist flexor stretch') }, { name: 'Finger Extensor Stretch', videoUrl: yt('climber forearm stretch') }],
  quads: [{ name: 'Couch Stretch', videoUrl: yt('couch stretch') }, { name: 'Foam Roll Quads', videoUrl: yt('foam roll quads') }],
  hamstrings: [{ name: 'Seated Forward Fold', videoUrl: yt('seated forward fold') }, { name: 'Foam Roll Hamstrings', videoUrl: yt('foam roll hamstrings') }],
  glutes: [{ name: 'Pigeon Pose', videoUrl: yt('pigeon pose') }, { name: 'Lacrosse Ball Glutes', videoUrl: yt('lacrosse ball glutes') }],
  calves: [{ name: 'Wall Calf Stretch', videoUrl: yt('wall calf stretch') }, { name: 'Foam Roll Calves', videoUrl: yt('foam roll calves') }],
  core: [{ name: 'Cobra Pose', videoUrl: yt('cobra pose') }],
  'full-body': [{ name: 'Yoga Flow (20 min)', videoUrl: yt('20 minute yoga flow recovery') }, { name: 'Easy Zone-2 Walk', videoUrl: yt('zone 2 cardio walk') }],
};
