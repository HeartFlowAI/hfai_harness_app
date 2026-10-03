# Revised Aurora walk

Generated using an AI image-generation tool. `walk-cycle.png` is the selected transparent four-keyframe atlas; its prompt and playback layout are documented below.

## Final prompt

Use case: identity-preserve. Image1 is Aurora character reference. Image2 is a FAILED walking sheet: the legs are spread apart in all frames, so it looks like sliding. Fix by generating FOUR unmistakably distinct WALK GAIT KEYFRAMES in a 2x2 transparent atlas. Preserve same adult character, pink flowing hair, outfit, gold/purple/white heart details and crisp pixel art, same side-facing-right view and exact anatomical scale/camera across all four. Row1 column1 CONTACT: near LEFT leg straight forward and heel touching ground, far RIGHT leg extended back and toe on ground, arms opposite legs. Row1 column2 PASSING: LEFT leg vertical supporting her weight directly below the hip, RIGHT knee bent forward, RIGHT boot lifted OFF THE GROUND directly below the bent knee, legs close together rather than spread apart. Row2 column1 OPPOSITE CONTACT: RIGHT leg forward heel grounded, LEFT leg back toe grounded, opposite arm swing. Row2 column2 OPPOSITE PASSING: RIGHT leg vertical planted directly under the hip, LEFT knee bent forward with LEFT boot lifted OFF THE GROUND below bent knee, legs close together. For passing frames the silhouette must be radically different from contact frames: one straight vertical support leg and one bent knee, not two diagonal legs. Relaxed believable walking, NO running leap, no exaggerated bounce. Same hip height and floor baseline, character remains centered without translating across each cell. Whole figure inside each cell with generous transparent padding; all hair, hands and boots included. No text, gridlines, scenery or shadows. Exactly four sprites, no duplicates, true transparent background.

## Playback

Four source regions are measured in `src/pet-art.js`; no image pixels are modified. Canvas rendering aligns the ground baseline, preserves pixelated sampling, and mirrors the sprite for leftward travel. Each keyframe holds 180 ms. All code-native teleport effects are in `src/pet.css` and `src/pet-motion.js`.
