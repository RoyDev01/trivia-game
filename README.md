# מי זה? מה זה?

A Hebrew picture trivia game for phones. Each question shows a picture and four answers.
Five topics: 1940s film actors and films, flowers, Israeli prime ministers, capital cities, World War II.

It is a static site: `index.html`, `styles.css`, `app.js`, `questions.js`. No build step.

## Pictures

- **Flowers, capital cities, World War II**: the game asks English Wikipedia for the lead image of each
  article (the `title` field in `questions.js`) and shows it. After each answer there is a link to the
  image's file page (author and licence). The "כל התמונות והמקורות" link on the home screen lists them all.
- **Actors, films and prime ministers**: the game shows a clue card. To show a photo of your own instead,
  add a JPG to the matching folder with the matching name. A "רמז" button then reveals the clue.

### Photo file names

`images/actors/`

bogart.jpg, bergman.jpg, stewart.jpg, welles.jpg, hayworth.jpg, chaplin.jpg, hepburn.jpg, grant.jpg,
olivier.jpg, peck.jpg, fonda.jpg, bacall.jpg, fontaine.jpg, crawford.jpg, cooper.jpg,
film-casablanca.jpg, film-bambi.jpg, film-bicycle-thieves.jpg, film-third-man.jpg

`images/pm/`

ben-gurion.jpg, sharett.jpg, eshkol.jpg, golda.jpg, rabin.jpg, begin.jpg, shamir.jpg, peres.jpg,
netanyahu.jpg, barak.jpg, sharon.jpg, olmert.jpg, bennett.jpg, lapid.jpg

Landscape photos (4:3) fit best.

## Editing questions

Everything is in `questions.js`. `a` is the right answer, `w` the three wrong ones.
For picture topics, `title` is the English Wikipedia article whose lead image is shown.

## Deploy

Render static site: build command `true`, publish directory `.`
