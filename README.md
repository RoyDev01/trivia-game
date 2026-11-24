# מי זה? מה זה?

A Hebrew picture trivia game for phones. Each question shows a picture or a clue card and four answers.
Six topics: 1940s film actors and films, flowers, Israeli prime ministers, capital cities, World War II,
and Israeli history from 1920 to today. 346 questions in all; each round draws 10 at random.

It is a static site with no build step: `index.html`, `styles.css`, `app.js` and three question files
(`questions.js`, `questions-more.js`, `questions-history.js`).

## Pictures

- **Flowers, capital cities, World War II and part of the history topic**: the game asks English Wikipedia
  for the lead image of each article (the `title` field) and shows it. After each answer there is a link to
  the image's file page (author and licence). The "כל התמונות והמקורות" link on the home screen lists them all.
- **Actors, films and prime ministers**: the game shows a clue card. To show a photo of your own instead,
  add a JPG to the matching folder with the matching name. A "רמז" button then reveals the clue.
  One photo per person is enough: every card about that person uses it.

### Photo file names

`images/actors/`

bogart.jpg, bergman.jpg, stewart.jpg, welles.jpg, hayworth.jpg, chaplin.jpg, hepburn.jpg, grant.jpg,
olivier.jpg, peck.jpg, fonda.jpg, bacall.jpg, fontaine.jpg, crawford.jpg, cooper.jpg, film-
casablanca.jpg, film-bambi.jpg, film-bicycle-thieves.jpg, film-third-man.jpg, leigh.jpg, cagney.jpg,
tracy.jpg, davis.jpg, stanwyck.jpg, robinson.jpg, tierney.jpg, gardner.jpg, lancaster.jpg,
turner.jpg, garland.jpg, kelly.jpg, astaire.jpg, crosby.jpg, wayne.jpg, dehavilland.jpg, garson.jpg,
taylor.jpg, guinness.jpg, power.jpg, chaney.jpg, lamarr.jpg, douglas.jpg, gwenn.jpg,
greenstreet.jpg, rains.jpg, wilson.jpg, russell.jpg, gable.jpg, garbo.jpg, rathbone.jpg,
mcdaniel.jpg, film-fantasia.jpg, film-dumbo.jpg, film-pinocchio.jpg, film-rebecca.jpg, film-
miracle.jpg, film-sierra-madre.jpg, film-to-be.jpg, film-lassie.jpg

`images/pm/`

ben-gurion.jpg, sharett.jpg, eshkol.jpg, golda.jpg, rabin.jpg, begin.jpg, shamir.jpg, peres.jpg,
netanyahu.jpg, barak.jpg, sharon.jpg, olmert.jpg, bennett.jpg, lapid.jpg, allon.jpg

Landscape photos (4:3) fit best.

## Editing questions

`a` is the right answer, `w` the three wrong ones, `q` an optional question text.
A question has either `title` (the English Wikipedia article whose lead image is shown) or `clue` (a card).

## Deploy

Render static site: build command `true`, publish directory `.`
