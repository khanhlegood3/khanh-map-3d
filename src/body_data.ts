export const BODY_AREAS = [
  { id: 'head', label: 'Head', dots: [[10, 5], [11, 5], [12, 5], [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [9, 7], [10, 7], [11, 7], [12, 7], [13, 7], [10, 8], [11, 8], [12, 8]] },
  { id: 'neck', label: 'Neck', dots: [[10, 9], [11, 9], [12, 9], [10, 10], [11, 10], [12, 10]] },
  { id: 'chest', label: 'Chest', dots: [[8, 11], [9, 11], [10, 11], [11, 11], [12, 11], [13, 11], [14, 11], [8, 12], [9, 12], [10, 12], [11, 12], [12, 12], [13, 12], [14, 12], [8, 13], [9, 13], [10, 13], [11, 13], [12, 13], [13, 13], [14, 13]] },
  { id: 'stomach', label: 'Stomach', dots: [[9, 14], [10, 14], [11, 14], [12, 14], [13, 14], [9, 15], [10, 15], [11, 15], [12, 15], [13, 15], [10, 16], [11, 16], [12, 16]] },
  { id: 'leftArm', label: 'Left Arm', dots: [[6, 12], [6, 13], [6, 14], [6, 15], [6, 16], [6, 17], [6, 18], [7, 12], [7, 13], [7, 14], [7, 15], [7, 16], [7, 17], [7, 18]] },
  { id: 'rightArm', label: 'Right Arm', dots: [[16, 12], [16, 13], [16, 14], [16, 15], [16, 16], [16, 17], [16, 18], [15, 12], [15, 13], [15, 14], [15, 15], [15, 16], [15, 17], [15, 18]] },
  { id: 'leftLeg', label: 'Left Leg', dots: [[9, 17], [10, 17], [9, 18], [10, 18], [9, 19], [10, 19], [9, 20], [10, 20], [9, 21], [10, 21], [9, 22], [10, 22], [9, 23], [10, 23]] },
  { id: 'rightLeg', label: 'Right Leg', dots: [[12, 17], [13, 17], [12, 18], [13, 18], [12, 19], [13, 19], [12, 20], [13, 20], [12, 21], [13, 21], [12, 22], [13, 22], [12, 23], [13, 23]] },
];

export function allBodyDots() {
  const map = new Map();
  BODY_AREAS.forEach(area => area.dots.forEach(([x, y], index) => map.set(`${area.id}-${index}`, { id: `${area.id}-${index}`, x, y, areaId: area.id, areaLabel: area.label })));
  return Array.from(map.values());
}

export const PARTS = [
  { id: 'head', label: 'Head', sections: ['Eyes & Brows', 'Nose', 'Mouth', 'Jaw & Chin'] },
  { id: 'chest', label: 'Chest', sections: ['Right Chest', 'Left Chest', 'Left Lower Chest', 'Right Lower Chest'] },
  { id: 'stomach', label: 'Stomach', sections: ['Upper Right Abdomen', 'Upper Left Abdomen', 'Navel (Center)', 'Lower Right Abdomen', 'Lower Left Abdomen'] },
  { id: 'leftHand', label: 'Left Hand', sections: ['Thumb', 'Index Finger', 'Middle Finger', 'Ring Finger', 'Pinky Finger', 'Palm'] },
  { id: 'rightHand', label: 'Right Hand', sections: ['Pinky Finger', 'Ring Finger', 'Middle Finger', 'Thumb', 'Index Finger', 'Palm'] },
  { id: 'leftLeg', label: 'Left Leg', sections: ['Thigh', 'Knee', 'Shin', 'Ankle', 'Foot'] },
  { id: 'rightLeg', label: 'Right Leg', sections: ['Thigh', 'Knee', 'Foot', 'Ankle', 'Shin'] },
  { id: 'back', label: 'Back', sections: ['Right Shoulder Blade', 'Lower Right Back', 'Mid Left Back', 'Left Shoulder Blade'] },
];

const isEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => 
  ((x - cx) ** 2) / (rx ** 2) + ((y - cy) ** 2) / (ry ** 2) <= 1;

const between = (v: number, min: number, max: number) => v >= min && v <= max;

export function buildOrganDots(partId: string) {
  const dots: { id: string; x: number; y: number; section: string }[] = [];
  for (let y = 0; y < 38; y += 1) {
    for (let x = 0; x < 42; x += 1) {
      let section: string | null = null;
      if (partId === 'head') {
        const visible = isEllipse(x, y, 21, 18, 11.5, 12.5) || isEllipse(x, y, 13, 22, 3.4, 3.2) || isEllipse(x, y, 29, 22, 3.4, 3.2) || isEllipse(x, y, 21, 30, 6.7, 4.8);
        if (visible) section = y < 18 ? 'Eyes & Brows' : between(y, 18, 23) ? 'Nose' : y < 29 ? 'Mouth' : 'Jaw & Chin';
      } else if (partId === 'chest') {
        const visible = isEllipse(x, y, 21, 20, 14.5, 13);
        if (visible) section = x < 21 ? (y > 24 ? 'Left Lower Chest' : 'Left Chest') : (y > 24 ? 'Right Lower Chest' : 'Right Chest');
      } else if (partId === 'stomach') {
        const visible = isEllipse(x, y, 21, 19, 13.5, 12.5);
        if (visible) section = isEllipse(x, y, 21, 20, 4.4, 4.4) ? 'Navel (Center)' : y < 19 ? (x < 21 ? 'Upper Left Abdomen' : 'Upper Right Abdomen') : (x < 21 ? 'Lower Left Abdomen' : 'Lower Right Abdomen');
      } else if (partId === 'back') {
        const visible = isEllipse(x, y, 21, 20, 14, 14);
        if (visible) section = y < 20 ? (x < 21 ? 'Right Shoulder Blade' : 'Left Shoulder Blade') : (x < 21 ? 'Lower Right Back' : 'Mid Left Back');
      } else if (partId === 'leftLeg' || partId === 'rightLeg') {
        const visible = (between(x, 15, 27) && between(y, 8, 28)) || isEllipse(x, y, 21, 6, 5.2, 3.8) || isEllipse(x, y, 21, 31, 4.5, 3.5) || (between(x, 15, 27) && between(y, 34, 35));
        if (visible) section = y < 12 ? 'Thigh' : y < 16 ? 'Knee' : y < 27 ? 'Shin' : y < 33 ? 'Ankle' : 'Foot';
      } else {
        const fingers = [
          { section: partId === 'leftHand' ? 'Thumb' : 'Pinky Finger', cx: 6, cy: 13, rx: 2.4, ry: 6.5 },
          { section: partId === 'leftHand' ? 'Index Finger' : 'Ring Finger', cx: 13, cy: 11, rx: 3, ry: 7.4 },
          { section: 'Middle Finger', cx: 21, cy: 10, rx: 3, ry: 8.2 },
          { section: partId === 'leftHand' ? 'Ring Finger' : 'Thumb', cx: 29, cy: 11, rx: 3, ry: 7.4 },
          { section: partId === 'leftHand' ? 'Pinky Finger' : 'Index Finger', cx: 36, cy: 13, rx: 2.5, ry: 6.5 },
        ];
        const finger = fingers.find(item => isEllipse(x, y, item.cx, item.cy, item.rx, item.ry));
        const palm = isEllipse(x, y, 21, 29, 14.5, 7.2);
        if (finger) section = finger.section;
        else if (palm) section = 'Palm';
      }

      if (section) dots.push({ id: `${x}-${y}`, x, y, section });
    }
  }

  return dots;
}
