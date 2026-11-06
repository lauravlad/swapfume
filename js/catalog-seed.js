/*
  Starter perfume catalog, written by hand for this app (not copied from any website or database).
  Each row: [brand, name, concentration, year, family, top notes, heart notes, base notes]
  - year is null when not certain
  - notes are comma-separated, written from general knowledge and kept short/general where unsure.
    They are community-maintained: members can suggest corrections, an admin approves them.
  The same list is turned into supabase/seed.sql and the data part of
  supabase/migrations/005_notes_and_images.sql by:  node tools/make-seed-sql.js
*/
window.SCENT_FAMILIES = ["floral", "woody", "amber", "citrus", "fresh", "aquatic", "green", "fruity", "gourmand", "musky", "leather", "aromatic", "chypre", "fougère"];

// Rule: everything from 2000 onward; before 2000 only true classics that are still made and sold today.
window.CATALOG_SEED = [
  // Chanel
  ["Chanel", "No. 5", "Eau de Parfum", 1986, "floral", "aldehydes, neroli, bergamot", "rose, jasmine, iris, ylang-ylang", "sandalwood, vanilla, vetiver"],
  ["Chanel", "No. 5 L'Eau", "Eau de Toilette", 2016, "floral", "lemon, orange, aldehydes", "rose, jasmine, ylang-ylang", "cedar, white musk"],
  ["Chanel", "Coco Mademoiselle", "Eau de Parfum", 2001, "chypre", "orange, bergamot", "rose, jasmine", "patchouli, vetiver, vanilla, white musk"],
  ["Chanel", "Coco Noir", "Eau de Parfum", 2012, "amber", "grapefruit, bergamot", "rose, jasmine, geranium", "patchouli, sandalwood, tonka, vanilla, incense"],
  ["Chanel", "Chance Eau Tendre", "Eau de Toilette", 2010, "floral", "grapefruit, quince", "jasmine, hyacinth", "white musk, iris, cedar"],
  ["Chanel", "Chance", "Eau de Parfum", 2005, "floral", "pink pepper, citrus", "jasmine, iris", "patchouli, vanilla, white musk"],
  ["Chanel", "Gabrielle", "Eau de Parfum", 2017, "floral", "mandarin, grapefruit", "jasmine, tuberose, orange blossom, ylang-ylang", "sandalwood, musk"],
  ["Chanel", "Bleu de Chanel", "Eau de Parfum", 2014, "woody", "grapefruit, lemon, mint", "ginger, nutmeg, jasmine", "incense, sandalwood, cedar, labdanum"],
  ["Chanel", "Allure Homme Sport", "Eau de Toilette", 2004, "fresh", "orange, aldehydes", "pepper, neroli, sea notes", "tonka, vanilla, white musk, cedar"],
  ["Chanel", "Coromandel", "Eau de Parfum", 2007, "amber", "bergamot, orange", "patchouli, iris", "benzoin, incense, white musk"],
  ["Chanel", "Sycomore", "Eau de Parfum", 2008, "woody", "pink pepper, juniper", "vetiver", "cedar, sandalwood"],
  ["Chanel", "Égoïste Platinum", "Eau de Toilette", 1993, "fougère", "lavender, rosemary, petitgrain", "geranium, clary sage", "vetiver, oakmoss, cedar"],
  // Dior
  ["Dior", "J'adore", "Eau de Parfum", 1999, "floral", "pear, melon, mandarin", "jasmine, rose, ylang-ylang, tuberose", "musk, vanilla, cedar"],
  ["Dior", "Miss Dior", "Eau de Parfum", 2017, "floral", "mandarin, pink pepper", "rose, peony, lily of the valley", "patchouli, rosewood, musk"],
  ["Dior", "Miss Dior Blooming Bouquet", "Eau de Toilette", 2014, "floral", "mandarin", "peony, rose", "white musk"],
  ["Dior", "Hypnotic Poison", "Eau de Toilette", 1998, "amber", "coconut, plum, apricot", "jasmine, tuberose, caraway", "vanilla, almond, sandalwood, musk"],
  ["Dior", "Poison", "Eau de Toilette", 1985, "amber", "plum, coriander, berries", "tuberose, rose, cinnamon", "vanilla, amber, sandalwood, musk"],
  ["Dior", "Sauvage", "Eau de Toilette", 2015, "aromatic", "bergamot, pepper", "Sichuan pepper, lavender, geranium", "ambroxan, cedar, labdanum"],
  ["Dior", "Sauvage", "Eau de Parfum", 2018, "aromatic", "bergamot", "Sichuan pepper, lavender, star anise, nutmeg", "ambroxan, vanilla"],
  ["Dior", "Dior Homme Intense", "Eau de Parfum", 2011, "woody", "lavender", "iris, ambrette, pear", "vetiver, cedar"],
  ["Dior", "Fahrenheit", "Eau de Toilette", 1988, "leather", "nutmeg, lavender, mandarin, bergamot", "violet leaf, honeysuckle", "leather, vetiver, cedar"],
  ["Dior", "Eau Sauvage", "Eau de Toilette", 1966, "citrus", "lemon, bergamot, basil, rosemary", "jasmine, coriander", "vetiver, oakmoss, musk"],
  ["Dior", "Oud Ispahan", "Eau de Parfum", 2012, "woody", "labdanum", "rose", "oud, patchouli, sandalwood"],
  ["Dior", "Gris Dior", "Eau de Parfum", 2013, "chypre", "bergamot", "rose, jasmine", "patchouli, oakmoss, musk"],
  ["Dior", "Ambre Nuit", "Eau de Parfum", 2009, "amber", "bergamot, pink pepper", "rose", "amber, guaiac wood"],
  // Guerlain
  ["Guerlain", "Shalimar", "Eau de Parfum", 1925, "amber", "bergamot, lemon", "iris, jasmine, rose", "vanilla, incense, tonka, opoponax"],
  ["Guerlain", "Mitsouko", "Eau de Toilette", 1919, "chypre", "bergamot", "peach, rose, jasmine", "oakmoss, labdanum, vetiver"],
  ["Guerlain", "L'Heure Bleue", "Eau de Parfum", 1912, "floral", "anise, bergamot, neroli", "carnation, violet, iris, rose", "vanilla, tonka, benzoin, musk"],
  ["Guerlain", "Habit Rouge", "Eau de Toilette", 1965, "amber", "bergamot, lemon, orange", "rose, carnation, cinnamon", "leather, vanilla, benzoin, opoponax"],
  ["Guerlain", "Vetiver", "Eau de Toilette", 1961, "woody", "bergamot, lemon", "nutmeg, pepper, tobacco", "vetiver"],
  ["Guerlain", "La Petite Robe Noire", "Eau de Parfum", 2012, "gourmand", "black cherry, almond, bergamot", "rose, licorice", "black tea, vanilla, patchouli"],
  ["Guerlain", "Mon Guerlain", "Eau de Parfum", 2017, "amber", "lavender, bergamot", "iris, jasmine", "vanilla, sandalwood, coumarin"],
  ["Guerlain", "Aqua Allegoria Pera Granita", "Eau de Toilette", null, "fruity", "pear, citrus", "white flowers", "musk"],
  ["Guerlain", "L'Homme Idéal", "Eau de Parfum", 2016, "amber", "citrus, almond", "leather", "tonka, vanilla"],
  // Yves Saint Laurent
  ["Yves Saint Laurent", "Black Opium", "Eau de Parfum", 2014, "gourmand", "pear, pink pepper, orange blossom", "coffee, jasmine", "vanilla, patchouli, cedar"],
  ["Yves Saint Laurent", "Libre", "Eau de Parfum", 2019, "floral", "lavender, mandarin", "orange blossom, jasmine", "vanilla, musk, cedar"],
  ["Yves Saint Laurent", "Mon Paris", "Eau de Parfum", 2016, "fruity", "strawberry, raspberry, pear", "peony, jasmine", "patchouli, white musk"],
  ["Yves Saint Laurent", "Opium", "Eau de Parfum", 1977, "amber", "mandarin, plum, clove", "carnation, jasmine, rose, cinnamon", "incense, myrrh, opoponax, vanilla"],
  ["Yves Saint Laurent", "Y", "Eau de Parfum", 2018, "fougère", "apple, ginger, bergamot", "sage, juniper, geranium", "tonka, amberwood, cedar"],
  ["Yves Saint Laurent", "La Nuit de L'Homme", "Eau de Toilette", 2009, "aromatic", "cardamom, bergamot", "lavender, cedar", "vetiver, caraway"],
  ["Yves Saint Laurent", "Kouros", "Eau de Toilette", 1981, "fougère", "aldehydes, artemisia, coriander", "geranium, clove", "honey, leather, musk, oakmoss, incense"],
  ["Yves Saint Laurent", "Tuxedo", "Eau de Parfum", 2015, "amber", "spices", "patchouli", "vanilla, amber"],
  // Lancôme
  ["Lancôme", "La Vie Est Belle", "Eau de Parfum", 2012, "gourmand", "blackcurrant, pear", "iris, jasmine, orange blossom", "praline, vanilla, patchouli, tonka"],
  ["Lancôme", "Idôle", "Eau de Parfum", 2019, "floral", "bergamot, pear, pink pepper", "rose, jasmine", "white musk, vanilla"],
  ["Lancôme", "Trésor", "Eau de Parfum", 1990, "floral", "peach, bergamot", "rose, iris, heliotrope", "vanilla, sandalwood, musk"],
  ["Lancôme", "Hypnôse", "Eau de Parfum", 2005, "amber", "passionflower", "jasmine, gardenia", "vanilla, vetiver"],
  // Giorgio Armani
  ["Giorgio Armani", "Acqua di Giò", "Eau de Toilette", 1996, "aquatic", "lime, lemon, bergamot, sea notes", "jasmine, rosemary", "white musk, cedar, patchouli"],
  ["Giorgio Armani", "Acqua di Giò Profumo", "Parfum", 2015, "aquatic", "bergamot, sea notes", "geranium, sage, rosemary", "incense, patchouli"],
  ["Giorgio Armani", "Acqua di Gioia", "Eau de Parfum", 2010, "fresh", "lemon, mint, pink pepper", "jasmine", "cedar, labdanum, brown sugar"],
  ["Giorgio Armani", "Sì", "Eau de Parfum", 2013, "chypre", "blackcurrant", "rose, freesia", "vanilla, patchouli, ambroxan"],
  ["Giorgio Armani", "My Way", "Eau de Parfum", 2020, "floral", "bergamot, orange blossom", "tuberose, jasmine", "vanilla, white musk, cedar"],
  ["Giorgio Armani", "Code", "Eau de Toilette", 2004, "amber", "bergamot, lemon", "olive blossom, star anise", "tonka, guaiac wood, leather"],
  ["Giorgio Armani", "Stronger With You", "Eau de Toilette", 2017, "gourmand", "cardamom, pink pepper, mint", "sage, lavender", "chestnut, vanilla"],
  // Prada
  ["Prada", "Candy", "Eau de Parfum", 2011, "gourmand", "caramel", "musk, powdery notes", "benzoin, vanilla"],
  ["Prada", "Infusion d'Iris", "Eau de Parfum", 2007, "floral", "mandarin, orange blossom", "iris, galbanum", "incense, cedar, vetiver, benzoin"],
  ["Prada", "L'Homme", "Eau de Toilette", 2016, "woody", "neroli, black pepper, cardamom", "iris, violet, geranium", "amber, patchouli, cedar"],
  ["Prada", "Luna Rossa Carbon", "Eau de Toilette", 2017, "aromatic", "bergamot, pepper", "lavender, metallic notes", "ambroxan, patchouli"],
  ["Prada", "Paradoxe", "Eau de Parfum", 2022, "floral", "pear, bergamot, mandarin", "neroli, jasmine", "amber, white musk, vanilla"],
  // Gucci
  ["Gucci", "Bloom", "Eau de Parfum", 2017, "floral", "jasmine", "tuberose, Rangoon creeper", "orris root"],
  ["Gucci", "Guilty Pour Homme", "Eau de Toilette", 2011, "aromatic", "lemon, lavender, pink pepper", "orange blossom, neroli", "patchouli, cedar"],
  ["Gucci", "Flora Gorgeous Gardenia", "Eau de Parfum", 2021, "floral", "pear blossom, red berries", "gardenia, jasmine", "brown sugar, patchouli"],
  // Tom Ford
  ["Tom Ford", "Black Orchid", "Eau de Parfum", 2006, "amber", "truffle, blackcurrant, ylang-ylang, bergamot", "orchid, spices, fruity notes", "patchouli, chocolate, vanilla, incense, sandalwood"],
  ["Tom Ford", "Tobacco Vanille", "Eau de Parfum", 2007, "amber", "tobacco leaf, spices", "tonka, vanilla, cacao, tobacco flower", "dried fruits, woody notes"],
  ["Tom Ford", "Oud Wood", "Eau de Parfum", 2007, "woody", "rosewood, cardamom, pepper", "oud, sandalwood, vetiver", "tonka, vanilla, amber"],
  ["Tom Ford", "Neroli Portofino", "Eau de Parfum", 2011, "citrus", "bergamot, mandarin, lemon, lavender", "neroli, orange blossom, jasmine", "amber, angelica, ambrette"],
  ["Tom Ford", "Lost Cherry", "Eau de Parfum", 2018, "gourmand", "black cherry, cherry liqueur, bitter almond", "rose, jasmine", "tonka, sandalwood, vanilla"],
  ["Tom Ford", "Soleil Blanc", "Eau de Parfum", 2016, "floral", "bergamot, cardamom, pistachio", "ylang-ylang, jasmine, tuberose", "coconut, tonka, amber, benzoin"],
  ["Tom Ford", "Ombré Leather", "Eau de Parfum", 2018, "leather", "cardamom", "leather, jasmine", "amber, moss, patchouli"],
  ["Tom Ford", "Noir de Noir", "Eau de Parfum", 2007, "chypre", "saffron", "rose, truffle", "oud, patchouli, vanilla, oakmoss"],
  ["Tom Ford", "Fucking Fabulous", "Eau de Parfum", 2017, "leather", "lavender, clary sage, bitter almond", "leather, orris", "tonka, vanilla, cashmeran"],
  ["Tom Ford", "Bitter Peach", "Eau de Parfum", 2020, "fruity", "peach, blood orange, cardamom", "rum, cognac, jasmine", "vanilla, tonka, sandalwood"],
  ["Tom Ford", "Rose Prick", "Eau de Parfum", 2020, "floral", "Sichuan pepper, turmeric", "rose", "patchouli, tonka"],
  // Hermès
  ["Hermès", "Terre d'Hermès", "Eau de Toilette", 2006, "woody", "orange, grapefruit", "pepper, geranium, flint", "vetiver, cedar, patchouli, benzoin"],
  ["Hermès", "Un Jardin sur le Nil", "Eau de Toilette", 2005, "green", "green mango, grapefruit", "lotus, hyacinth", "sycamore wood, musk, incense"],
  ["Hermès", "Twilly d'Hermès", "Eau de Parfum", 2017, "floral", "ginger", "tuberose", "sandalwood"],
  ["Hermès", "Eau des Merveilles", "Eau de Toilette", 2004, "woody", "orange, lemon", "pepper", "amber, woods, oakmoss"],
  ["Hermès", "H24", "Eau de Toilette", 2021, "aromatic", "clary sage", "narcissus", "rosewood, metallic notes"],
  // Le Labo
  ["Le Labo", "Santal 33", "Eau de Parfum", 2011, "woody", "cardamom, violet", "iris, papyrus", "sandalwood, cedar, leather"],
  ["Le Labo", "Another 13", "Eau de Parfum", 2010, "musky", "pear, citrus", "ambroxan, jasmine", "musk, moss"],
  ["Le Labo", "Rose 31", "Eau de Parfum", 2006, "floral", "rose, cumin", "spices", "cedar, oud, musk"],
  ["Le Labo", "Thé Noir 29", "Eau de Parfum", 2015, "woody", "bergamot, fig, bay leaf", "black tea, cedar", "vetiver, tobacco, musk"],
  ["Le Labo", "Bergamote 22", "Eau de Parfum", 2006, "citrus", "bergamot, grapefruit, petitgrain", "orange blossom", "vetiver, cedar, musk, amber"],
  ["Le Labo", "Lys 41", "Eau de Parfum", 2014, "floral", "lily", "tuberose, jasmine", "vanilla, musk, woods"],
  // Byredo
  ["Byredo", "Gypsy Water", "Eau de Parfum", 2008, "woody", "bergamot, lemon, juniper, pepper", "incense, pine needles, orris", "amber, vanilla, sandalwood"],
  ["Byredo", "Mojave Ghost", "Eau de Parfum", 2014, "woody", "ambrette, sapodilla", "magnolia, violet, sandalwood", "cedar, amber, musk"],
  ["Byredo", "Bal d'Afrique", "Eau de Parfum", 2009, "floral", "bergamot, lemon, neroli, marigold", "violet, cyclamen, jasmine", "vetiver, musk, cedar, amber"],
  ["Byredo", "Blanche", "Eau de Parfum", 2009, "musky", "aldehydes, rose, pink pepper", "peony, violet, neroli", "musk, sandalwood"],
  ["Byredo", "Rose of No Man's Land", "Eau de Parfum", 2015, "floral", "pink pepper", "rose, raspberry blossom", "papyrus, white amber"],
  ["Byredo", "Bibliothèque", "Eau de Parfum", 2018, "leather", "plum, peach", "peony, violet", "leather, vanilla, patchouli"],
  // Maison Francis Kurkdjian
  ["Maison Francis Kurkdjian", "Baccarat Rouge 540", "Eau de Parfum", 2015, "amber", "saffron, jasmine", "amberwood, ambergris", "fir resin, cedar"],
  ["Maison Francis Kurkdjian", "Baccarat Rouge 540", "Extrait de Parfum", 2017, "amber", "bitter almond, saffron", "jasmine", "amber, musk, woods"],
  ["Maison Francis Kurkdjian", "Aqua Universalis", "Eau de Toilette", 2009, "citrus", "bergamot, lemon", "lily of the valley, white flowers", "musk, woods"],
  ["Maison Francis Kurkdjian", "Gentle Fluidity Gold", "Eau de Parfum", 2019, "amber", "juniper, nutmeg", "coriander, musk", "vanilla, amberwood"],
  ["Maison Francis Kurkdjian", "Grand Soir", "Eau de Parfum", 2016, "amber", "amber accord", "benzoin", "vanilla, tonka"],
  ["Maison Francis Kurkdjian", "Oud Satin Mood", "Eau de Parfum", 2015, "amber", "violet", "rose, oud", "vanilla, benzoin, amber"],
  // Maison Margiela
  ["Maison Margiela", "Replica Jazz Club", "Eau de Toilette", 2013, "amber", "pink pepper, lemon, neroli", "rum, clary sage, vetiver", "tobacco leaf, vanilla, styrax"],
  ["Maison Margiela", "Replica By the Fireplace", "Eau de Toilette", 2015, "woody", "clove, pink pepper, orange blossom", "chestnut, guaiac wood, juniper", "vanilla, cashmeran, Peru balsam"],
  ["Maison Margiela", "Replica Lazy Sunday Morning", "Eau de Toilette", 2013, "musky", "pear, aldehydes", "lily of the valley, iris, rose", "white musk, ambrette, patchouli"],
  ["Maison Margiela", "Replica Beach Walk", "Eau de Toilette", 2012, "fresh", "bergamot, lemon, pink pepper", "ylang-ylang, coconut milk, heliotrope", "musk, cedar, benzoin"],
  ["Maison Margiela", "Replica Coffee Break", "Eau de Toilette", 2015, "gourmand", "coffee", "milk notes, lavender", "vanilla, musk"],
  ["Maison Margiela", "Replica Bubble Bath", "Eau de Toilette", 2020, "musky", "bergamot, pink pepper", "lavender, rose, coconut milk", "white musk"],
  // Diptyque
  ["Diptyque", "Philosykos", "Eau de Toilette", 1996, "green", "fig leaf, green notes", "fig, coconut", "fig wood, cedar"],
  ["Diptyque", "Do Son", "Eau de Toilette", 2005, "floral", "orange blossom, pink pepper", "tuberose, rose", "musk, benzoin"],
  ["Diptyque", "Tam Dao", "Eau de Toilette", 2003, "woody", "rosewood, cypress", "sandalwood", "cedar, amber, musk"],
  ["Diptyque", "Orphéon", "Eau de Parfum", 2021, "woody", "juniper", "jasmine", "cedar, tonka"],
  ["Diptyque", "Eau Rose", "Eau de Toilette", 2012, "floral", "blackcurrant, citrus", "rose", "musk, cedar"],
  ["Diptyque", "L'Ombre dans L'Eau", "Eau de Toilette", 1983, "green", "blackcurrant leaf", "rose", "green notes, musk"],
  ["Diptyque", "Fleur de Peau", "Eau de Parfum", 2018, "musky", "pink pepper, aldehydes", "iris, rose", "musk, ambrette"],
  // Creed
  ["Creed", "Aventus", "Eau de Parfum", 2010, "chypre", "pineapple, bergamot, blackcurrant, apple", "birch, patchouli, jasmine", "musk, oakmoss, ambergris, vanilla"],
  ["Creed", "Green Irish Tweed", "Eau de Parfum", 1985, "fougère", "lemon verbena, peppermint", "violet leaf, iris", "sandalwood, ambergris"],
  ["Creed", "Silver Mountain Water", "Eau de Parfum", 1995, "fresh", "bergamot, mandarin", "green tea, blackcurrant", "musk, sandalwood, petitgrain"],
  ["Creed", "Love in White", "Eau de Parfum", 2005, "floral", "orange peel", "iris, jasmine, magnolia", "sandalwood, vanilla, ambergris"],
  ["Creed", "Aventus for Her", "Eau de Parfum", 2016, "fruity", "green apple, lemon, pink pepper", "rose", "sandalwood, musk"],
  ["Creed", "Viking", "Eau de Parfum", 2017, "aromatic", "bergamot, lemon, pink pepper", "rose, peppermint", "sandalwood, vetiver, patchouli"],
  // Parfums de Marly
  ["Parfums de Marly", "Layton", "Eau de Parfum", 2016, "aromatic", "apple, lavender, bergamot, mandarin", "geranium, violet, jasmine", "vanilla, cardamom, sandalwood, patchouli"],
  ["Parfums de Marly", "Delina", "Eau de Parfum", 2017, "floral", "lychee, rhubarb, bergamot, nutmeg", "rose, peony", "vanilla, cashmeran, musk"],
  ["Parfums de Marly", "Pegasus", "Eau de Parfum", 2011, "amber", "bergamot, heliotrope, bitter almond", "lavender, jasmine", "vanilla, sandalwood, amber"],
  ["Parfums de Marly", "Herod", "Eau de Parfum", 2012, "amber", "cinnamon, pepper", "tobacco, incense, osmanthus", "vanilla, cypriol, musk"],
  ["Parfums de Marly", "Valaya", "Eau de Parfum", 2023, "musky", "aldehydes, bergamot", "orange blossom", "white musk, vanilla"],
  // Jo Malone London
  ["Jo Malone London", "Wood Sage & Sea Salt", "Cologne", 2014, "fresh", "ambrette, sea salt", "sage", "driftwood"],
  ["Jo Malone London", "English Pear & Freesia", "Cologne", 2010, "fruity", "pear, melon", "freesia, rose", "patchouli, musk, amber"],
  ["Jo Malone London", "Peony & Blush Suede", "Cologne", 2013, "floral", "red apple", "peony, rose, jasmine", "suede"],
  ["Jo Malone London", "Lime Basil & Mandarin", "Cologne", 1999, "citrus", "lime, mandarin", "basil, thyme", "vetiver, amber"],
  ["Jo Malone London", "Myrrh & Tonka", "Cologne Intense", 2016, "amber", "lavender", "myrrh", "tonka, vanilla, almond"],
  ["Jo Malone London", "Velvet Rose & Oud", "Cologne Intense", 2011, "floral", "clove", "rose", "oud, praline"],
  // Kilian
  ["Kilian", "Love, Don't Be Shy", "Eau de Parfum", 2007, "gourmand", "neroli, bergamot, pink pepper", "orange blossom, jasmine, honeysuckle", "marshmallow, vanilla, caramel, musk"],
  ["Kilian", "Angels' Share", "Eau de Parfum", 2020, "gourmand", "cognac", "cinnamon, tonka, oak", "praline, vanilla, sandalwood"],
  ["Kilian", "Good Girl Gone Bad", "Eau de Parfum", 2012, "floral", "osmanthus", "jasmine, tuberose, rose", "cedar, amber"],
  ["Kilian", "Black Phantom", "Eau de Parfum", 2017, "gourmand", "rum, sugarcane", "coffee, dark chocolate, heliotrope", "sandalwood, caramel"],
  // Frédéric Malle
  ["Frédéric Malle", "Portrait of a Lady", "Eau de Parfum", 2010, "floral", "raspberry, clove, cinnamon, blackcurrant", "rose", "patchouli, incense, sandalwood, musk, benzoin"],
  ["Frédéric Malle", "Carnal Flower", "Eau de Parfum", 2005, "floral", "eucalyptus, melon, bergamot", "tuberose, jasmine, orange blossom", "coconut, musk"],
  ["Frédéric Malle", "Musc Ravageur", "Eau de Parfum", 2000, "amber", "lavender, bergamot, mandarin", "cinnamon, clove", "vanilla, musk, amber, sandalwood"],
  ["Frédéric Malle", "Une Rose", "Eau de Parfum", 2003, "floral", "rose", "rose, geranium", "earthy notes, woods"],
  ["Frédéric Malle", "Lipstick Rose", "Eau de Parfum", 2000, "floral", "aldehydes, raspberry", "rose, violet", "vanilla, musk, vetiver"],
  // Serge Lutens
  ["Serge Lutens", "Ambre Sultan", "Eau de Parfum", 1993, "amber", "oregano, bay leaf, coriander", "myrtle, angelica", "amber, benzoin, labdanum, patchouli, vanilla"],
  ["Serge Lutens", "Féminité du Bois", "Eau de Parfum", 1992, "woody", "plum, orange blossom", "cinnamon, clove, honey", "cedar, musk"],
  ["Serge Lutens", "Chergui", "Eau de Parfum", 2001, "amber", "tobacco leaf, honey", "hay, iris, rose", "musk, sandalwood, amber, incense"],
  ["Serge Lutens", "La Fille de Berlin", "Eau de Parfum", 2013, "floral", "pepper", "rose", "musk, woods"],
  ["Serge Lutens", "Fleurs d'Oranger", "Eau de Parfum", 1995, "floral", "orange blossom, petitgrain", "jasmine, tuberose", "nutmeg, musk"],
  // L'Artisan Parfumeur
  ["L'Artisan Parfumeur", "Mûre et Musc", "Eau de Toilette", 1978, "fruity", "citrus, basil", "blackberry", "musk"],
  ["L'Artisan Parfumeur", "Timbuktu", "Eau de Toilette", 2004, "woody", "green mango, cardamom, pink pepper", "papyrus", "vetiver, incense, patchouli"],
  ["L'Artisan Parfumeur", "Passage d'Enfer", "Eau de Toilette", 1999, "woody", "incense", "lily", "sandalwood, benzoin"],
  // Juliette Has A Gun
  ["Juliette Has A Gun", "Not a Perfume", "Eau de Parfum", 2010, "musky", "", "", "ambroxan"],
  ["Juliette Has A Gun", "Mmmm...", "Eau de Parfum", 2017, "gourmand", "jasmine", "vanilla", "musk"],
  // Escentric Molecules
  ["Escentric Molecules", "Molecule 01", "Eau de Toilette", 2006, "woody", "", "", "Iso E Super"],
  ["Escentric Molecules", "Escentric 01", "Eau de Toilette", 2006, "woody", "lime, pink pepper", "Iso E Super", "incense, ambrette"],
  // Kayali
  ["Kayali", "Vanilla 28", "Eau de Parfum", 2018, "gourmand", "brown sugar", "vanilla orchid, jasmine", "amber, tonka, musk"],
  ["Kayali", "Yum Pistachio Gelato 33", "Eau de Parfum", 2021, "gourmand", "pistachio, almond", "vanilla, cream", "musk, sandalwood"],
  // Ariana Grande
  ["Ariana Grande", "Cloud", "Eau de Parfum", 2018, "gourmand", "lavender, pear, bergamot", "coconut, praline, vanilla orchid", "musk, cashmere woods"],
  ["Ariana Grande", "Sweet Like Candy", "Eau de Parfum", 2016, "gourmand", "blackberry", "marshmallow", "vanilla, musk"],
  // Sol de Janeiro
  ["Sol de Janeiro", "Cheirosa 62", "Perfume Mist", null, "gourmand", "pistachio, almond", "jasmine, heliotrope", "salted caramel, vanilla, sandalwood"],
  // Viktor&Rolf
  ["Viktor&Rolf", "Flowerbomb", "Eau de Parfum", 2005, "floral", "tea, bergamot", "orchid, jasmine, rose, freesia", "patchouli, musk"],
  ["Viktor&Rolf", "Spicebomb", "Eau de Toilette", 2012, "amber", "pink pepper, elemi, grapefruit, bergamot", "cinnamon, saffron, chili", "tobacco, leather, vetiver"],
  ["Viktor&Rolf", "Good Fortune", "Eau de Parfum", 2023, "floral", "spices", "jasmine", "vanilla, woods"],
  // Mugler
  ["Mugler", "Angel", "Eau de Parfum", 1992, "gourmand", "bergamot, red berries", "honey", "patchouli, vanilla, caramel, chocolate"],
  ["Mugler", "Alien", "Eau de Parfum", 2005, "floral", "jasmine", "cashmeran", "white amber"],
  ["Mugler", "A*Men", "Eau de Toilette", 1996, "amber", "lavender, mint, bergamot", "coffee, honey, caramel", "patchouli, tar, vanilla, tonka"],
  ["Mugler", "Aura", "Eau de Parfum", 2017, "green", "rhubarb leaf", "orange blossom", "vanilla, woods"],
  // Jean Paul Gaultier
  ["Jean Paul Gaultier", "Le Male", "Eau de Toilette", 1995, "fougère", "lavender, mint, cardamom, bergamot", "cinnamon, orange blossom, cumin", "vanilla, tonka, sandalwood, amber"],
  ["Jean Paul Gaultier", "Classique", "Eau de Toilette", 1993, "floral", "mandarin", "orange blossom, rose, ginger", "vanilla, amber, musk"],
  ["Jean Paul Gaultier", "Scandal", "Eau de Parfum", 2017, "floral", "blood orange, mandarin", "honey, gardenia, jasmine", "patchouli, beeswax, caramel"],
  ["Jean Paul Gaultier", "Le Beau", "Eau de Toilette", 2019, "amber", "bergamot", "coconut", "tonka, woods"],
  ["Jean Paul Gaultier", "Ultra Male", "Eau de Toilette", 2015, "amber", "pear, mint, bergamot", "cinnamon, clary sage, lavender", "vanilla, amber, cedar"],
  // Carolina Herrera
  ["Carolina Herrera", "Good Girl", "Eau de Parfum", 2016, "amber", "almond, coffee, bergamot", "tuberose, jasmine", "tonka, cacao, vanilla"],
  ["Carolina Herrera", "212 VIP", "Eau de Parfum", 2010, "gourmand", "rum, passion fruit", "gardenia", "vanilla, musk"],
  ["Carolina Herrera", "212 Men", "Eau de Toilette", 1999, "aromatic", "bergamot, lavender, green notes", "ginger, pepper", "sandalwood, musk, incense"],
  ["Carolina Herrera", "Bad Boy", "Eau de Toilette", 2019, "amber", "white pepper, black pepper, bergamot", "sage, cedar", "tonka, cacao, amberwood"],
  // Paco Rabanne
  ["Paco Rabanne", "1 Million", "Eau de Toilette", 2008, "amber", "blood mandarin, grapefruit, mint", "rose, cinnamon, spices", "leather, woody notes, amber, patchouli"],
  ["Paco Rabanne", "Lady Million", "Eau de Parfum", 2010, "floral", "raspberry, neroli, lemon", "jasmine, orange blossom, gardenia", "honey, patchouli, amber"],
  ["Paco Rabanne", "Invictus", "Eau de Toilette", 2013, "aquatic", "grapefruit, sea notes, mandarin", "bay leaf, jasmine", "ambergris, guaiac wood, oakmoss, patchouli"],
  ["Paco Rabanne", "Olympéa", "Eau de Parfum", 2015, "amber", "green mandarin, water jasmine, ginger flower", "vanilla, salt", "sandalwood, cashmere wood, ambergris"],
  ["Paco Rabanne", "Phantom", "Eau de Toilette", 2021, "aromatic", "lemon", "lavender, apple", "vanilla, vetiver, patchouli"],
  // Valentino
  ["Valentino", "Donna Born in Roma", "Eau de Parfum", 2019, "floral", "pink pepper, blackcurrant, bergamot", "jasmine", "vanilla, cashmeran"],
  ["Valentino", "Uomo Born in Roma", "Eau de Toilette", 2019, "aromatic", "violet leaf, salt", "sage, ginger", "vetiver, woods"],
  // Givenchy
  ["Givenchy", "L'Interdit", "Eau de Parfum", 2018, "floral", "pear, bergamot", "orange blossom, jasmine, tuberose", "patchouli, vetiver, vanilla, ambroxan"],
  ["Givenchy", "Gentleman", "Eau de Parfum", 2018, "woody", "black pepper", "iris", "patchouli, vanilla"],
  ["Givenchy", "Ange ou Démon", "Eau de Parfum", 2006, "amber", "mandarin, saffron", "lily, ylang-ylang, orchid", "vanilla, oak, tonka"],
  ["Givenchy", "Π (Pi)", "Eau de Toilette", 1998, "amber", "mandarin, rosemary, basil", "neroli", "vanilla, benzoin, tonka, almond"],
  // Narciso Rodriguez
  ["Narciso Rodriguez", "For Her", "Eau de Toilette", 2003, "musky", "orange blossom, osmanthus", "musk, amber", "vanilla, vetiver"],
  ["Narciso Rodriguez", "For Her", "Eau de Parfum", 2006, "musky", "rose, peach", "musk, amber", "patchouli, cedar"],
  ["Narciso Rodriguez", "Narciso", "Eau de Parfum", 2014, "musky", "gardenia, rose", "musk", "cedar, vetiver"],
  ["Narciso Rodriguez", "Musc Noir For Her", "Eau de Parfum", 2022, "musky", "plum", "musk", "suede"],
  // Dolce & Gabbana
  ["Dolce & Gabbana", "Light Blue", "Eau de Toilette", 2001, "citrus", "lemon, apple, cedar, bellflower", "bamboo, jasmine, white rose", "cedar, musk, amber"],
  ["Dolce & Gabbana", "Light Blue Pour Homme", "Eau de Toilette", 2007, "citrus", "grapefruit, bergamot, juniper", "rosemary, Sichuan pepper, rosewood", "musk, oakmoss, incense"],
  ["Dolce & Gabbana", "The One", "Eau de Parfum", 2006, "amber", "peach, lychee, mandarin, bergamot", "lily, plum, jasmine", "vanilla, amber, musk"],
  ["Dolce & Gabbana", "The One for Men", "Eau de Parfum", 2015, "amber", "grapefruit, coriander, basil", "ginger, cardamom, orange blossom", "tobacco, amber, cedar"],
  // Versace
  ["Versace", "Eros", "Eau de Toilette", 2012, "fougère", "mint, green apple, lemon", "tonka, ambroxan, geranium", "vanilla, vetiver, oakmoss, cedar"],
  ["Versace", "Bright Crystal", "Eau de Toilette", 2006, "floral", "pomegranate, yuzu", "peony, magnolia, lotus", "musk, mahogany, amber"],
  ["Versace", "Dylan Blue", "Eau de Toilette", 2016, "aromatic", "bergamot, grapefruit, fig leaf, water notes", "violet leaf, black pepper, ambroxan", "incense, tonka, musk"],
  // Burberry
  ["Burberry", "Her", "Eau de Parfum", 2018, "fruity", "strawberry, raspberry, blackberry, lemon", "violet, jasmine", "musk, amber"],
  ["Burberry", "Brit", "Eau de Parfum", 2003, "amber", "lime, pear, almond", "peony", "vanilla, tonka, mahogany, amber"],
  ["Burberry", "Hero", "Eau de Toilette", 2021, "woody", "bergamot", "juniper, black pepper", "cedar"],
  // Marc Jacobs
  ["Marc Jacobs", "Daisy", "Eau de Toilette", 2007, "floral", "strawberry, violet leaf, grapefruit", "violet, gardenia, jasmine", "musk, vanilla, white woods"],
  ["Marc Jacobs", "Perfect", "Eau de Parfum", 2020, "floral", "rhubarb, almond milk", "daffodil, jasmine", "cashmeran, cedar"],
  // Calvin Klein
  ["Calvin Klein", "CK One", "Eau de Toilette", 1994, "citrus", "bergamot, lemon, cardamom", "jasmine, violet, lily of the valley", "musk, amber, cedar, green tea"],
  ["Calvin Klein", "Eternity", "Eau de Parfum", 1988, "floral", "freesia, mandarin, sage", "lily, carnation", "sandalwood, musk, amber"],
  ["Calvin Klein", "Obsession", "Eau de Parfum", 1985, "amber", "mandarin, bergamot", "spices, jasmine, orange blossom", "amber, vanilla, musk, incense"],
  // Estée Lauder
  ["Estée Lauder", "Beautiful", "Eau de Parfum", 1985, "floral", "rose, lily, mandarin", "tuberose, jasmine, orange blossom", "sandalwood, vetiver, amber"],
  ["Estée Lauder", "Youth Dew", "Eau de Parfum", 1953, "amber", "aldehydes, orange, peach", "clove, cinnamon, rose, jasmine", "incense, amber, vanilla, patchouli"],
  ["Estée Lauder", "Pleasures", "Eau de Parfum", 1995, "floral", "green notes, violet leaf", "lily, peony, rose", "sandalwood, musk, patchouli"],
  // Clinique
  ["Clinique", "Happy", "Eau de Parfum", 1997, "citrus", "bergamot, mandarin, grapefruit", "freesia, lily", "musk, amber"],
  ["Clinique", "Aromatics Elixir", "Parfum de Toilette", 1971, "chypre", "herbs, aldehydes", "rose, jasmine, ylang-ylang", "patchouli, oakmoss, vetiver"],
  // Others, classic
  ["Elizabeth Arden", "Red Door", "Eau de Toilette", 1989, "floral", "ylang-ylang, peach", "rose, orchid, lily", "honey, sandalwood, vetiver"],
  ["Elizabeth Arden", "Green Tea", "Eau de Parfum", 1999, "green", "lemon, bergamot, mint, orange", "green tea, jasmine", "musk, oakmoss, amber"],
  ["Davidoff", "Cool Water", "Eau de Toilette", 1988, "aquatic", "mint, lavender, sea notes", "geranium, jasmine, neroli", "musk, sandalwood, oakmoss"],
  ["Azzaro", "Pour Homme", "Eau de Toilette", 1978, "fougère", "lavender, anise, basil, lemon", "iris, vetiver", "oakmoss, leather, tonka, amber"],
  ["Azzaro", "The Most Wanted", "Eau de Parfum", 2021, "amber", "cardamom", "toffee", "amberwood"],
  ["Issey Miyake", "L'Eau d'Issey", "Eau de Toilette", 1992, "aquatic", "lotus, melon, freesia, rose water", "lily, peony, carnation", "musk, cedar, sandalwood"],
  ["Issey Miyake", "L'Eau d'Issey Pour Homme", "Eau de Toilette", 1994, "aquatic", "yuzu, bergamot, lemon, coriander", "nutmeg, water lily", "vetiver, cedar, sandalwood, musk"],
  ["Kenzo", "Flower by Kenzo", "Eau de Parfum", 2000, "floral", "hawthorn, mandarin", "rose, violet", "vanilla, white musk, incense"],
  ["Cacharel", "Anaïs Anaïs", "Eau de Toilette", 1978, "floral", "hyacinth, orange blossom, galbanum", "jasmine, rose, lily of the valley", "sandalwood, vetiver, incense, musk"],
  ["Nina Ricci", "L'Air du Temps", "Eau de Toilette", 1948, "floral", "carnation, bergamot", "rose, jasmine, ylang-ylang", "sandalwood, musk, iris"],
  ["Chloé", "Chloé", "Eau de Parfum", 2008, "floral", "peony, lychee, freesia", "rose, magnolia, lily of the valley", "cedar, amber"],
  ["Chloé", "Nomade", "Eau de Parfum", 2018, "chypre", "mirabelle plum, bergamot, lemon", "freesia, peach, rose", "oakmoss, patchouli, sandalwood"],
  ["Bvlgari", "Omnia Crystalline", "Eau de Toilette", 2005, "floral", "bamboo, nashi pear", "lotus", "tea, white woods, musk"],
  ["Bvlgari", "Man in Black", "Eau de Parfum", 2014, "leather", "rum, spices", "iris, tuberose, leather", "tonka, benzoin, guaiac wood"],
  ["Montblanc", "Explorer", "Eau de Parfum", 2019, "woody", "bergamot, pink pepper, clary sage", "vetiver, leather", "patchouli, ambroxan"],
  ["Montblanc", "Legend", "Eau de Toilette", 2011, "fougère", "bergamot, lavender", "apple, rose", "tonka, sandalwood"],
  ["Hugo Boss", "Boss Bottled", "Eau de Toilette", 1998, "woody", "apple, plum, bergamot, lemon", "cinnamon, geranium, clove", "vanilla, sandalwood, cedar, vetiver"],
  ["Ralph Lauren", "Polo Green", "Eau de Toilette", 1978, "chypre", "artemisia, basil, pine", "juniper, leather", "oakmoss, patchouli, tobacco"],
  ["Lattafa", "Khamrah", "Eau de Parfum", 2022, "amber", "cinnamon, nutmeg, bergamot", "dates, praline", "vanilla, tonka, amber"],
  ["Armaf", "Club de Nuit Intense Man", "Eau de Toilette", 2015, "chypre", "pineapple, blackcurrant, apple, bergamot", "birch, jasmine", "musk, ambergris, vanilla, patchouli"],
  // Niche & indie
  ["Amouage", "Interlude Man", "Eau de Parfum", 2012, "amber", "bergamot, oregano, pimento", "incense, opoponax, amber", "leather, oud, sandalwood, patchouli"],
  ["Amouage", "Reflection Man", "Eau de Parfum", 2007, "floral", "rosemary, pink pepper", "jasmine, orris, neroli", "sandalwood, vetiver, cedar"],
  ["Amouage", "Jubilation XXV", "Eau de Parfum", 2008, "amber", "orange, coriander", "rose, frankincense, myrrh", "oakmoss, ambergris, patchouli"],
  ["Initio", "Side Effect", "Eau de Parfum", 2016, "amber", "rum", "tobacco, cinnamon", "vanilla"],
  ["Initio", "Oud for Greatness", "Eau de Parfum", 2018, "woody", "saffron, nutmeg, lavender", "oud", "patchouli, musk"],
  ["Xerjoff", "Naxos", "Eau de Parfum", 2015, "amber", "bergamot, lemon, lavender", "honey, cinnamon", "tobacco, tonka, vanilla"],
  ["Xerjoff", "Erba Pura", "Eau de Parfum", 2019, "fruity", "orange, lemon, bergamot", "fruity notes", "white musk, vanilla, amber"],
  ["Nishane", "Hacivat", "Extrait de Parfum", 2017, "chypre", "pineapple, grapefruit, bergamot", "cedar, patchouli, jasmine", "oakmoss, woody notes"],
  ["Nishane", "Ani", "Extrait de Parfum", 2019, "amber", "ginger, bergamot, cardamom", "vanilla", "sandalwood, benzoin, musk"],
  ["Mancera", "Cedrat Boisé", "Eau de Parfum", 2011, "woody", "citron, lemon, blackcurrant, spices", "patchouli, jasmine", "leather, sandalwood, oakmoss, musk, vanilla"],
  ["Montale", "Intense Café", "Eau de Parfum", 2013, "gourmand", "coffee", "rose", "vanilla, amber, musk"],
  ["Maison Crivelli", "Hibiscus Mahajád", "Extrait de Parfum", 2019, "floral", "pepper", "hibiscus, rose", "leather, woods"],
  ["Penhaligon's", "Halfeti", "Eau de Parfum", 2015, "amber", "grapefruit, bergamot, cardamom", "rose, jasmine, lavender", "oud, leather, tonka, sandalwood"],
  ["Penhaligon's", "Luna", "Eau de Toilette", 2016, "citrus", "orange, bergamot", "rose, jasmine", "myrrh, ambergris"],
  ["Atelier Cologne", "Orange Sanguine", "Cologne Absolue", 2010, "citrus", "blood orange, bitter orange, mandarin", "geranium, jasmine", "sandalwood, tonka, amber"],
  ["Acqua di Parma", "Colonia", "Eau de Cologne", 1916, "citrus", "lemon, bergamot, orange", "lavender, rosemary, verbena, rose", "vetiver, sandalwood, patchouli"],
  ["Acqua di Parma", "Blu Mediterraneo Fico di Amalfi", "Eau de Toilette", 2006, "green", "fig, lemon, bergamot, grapefruit", "fig nectar, pink pepper, jasmine", "fig wood, cedar, benzoin"],
  ["Comme des Garçons", "Wonderwood", "Eau de Parfum", 2010, "woody", "pepper, nutmeg", "cedar, guaiac wood, vetiver", "sandalwood, oud"],
  ["Comme des Garçons", "Hinoki", "Eau de Toilette", 2005, "woody", "camphor, cypress", "hinoki wood", "cedar, incense, vetiver"],
  ["D.S. & Durga", "I Don't Know What", "Eau de Parfum", 2018, "woody", "citrus", "vetiver", "ambroxan, Iso E Super"],
  ["Imaginary Authors", "A City on Fire", "Eau de Parfum", 2013, "woody", "smoky notes", "cistus", "woods"],
  ["Imaginary Authors", "Memoirs of a Trespasser", "Eau de Parfum", 2013, "amber", "", "vanilla", "guaiac wood, amber"],
  ["Zoologist", "Bat", "Extrait de Parfum", 2015, "woody", "fruity notes", "earthy, mineral notes", "musk, woods"],
  ["Phlur", "Missing Person", "Eau de Parfum", 2022, "musky", "bergamot", "jasmine", "musk, woods"],
  ["Glossier", "You", "Eau de Parfum", 2017, "musky", "pink pepper, iris", "ambrette", "ambroxan, musk"],
  ["Maison Louis Marie", "No. 04 Bois de Balincourt", "Perfume Oil", null, "woody", "", "vetiver", "sandalwood, cedar"],
  ["Henry Rose", "Torn", "Eau de Parfum", 2019, "woody", "", "woods", "musk"],
  ["Ellis Brooklyn", "Myth", "Eau de Parfum", null, "musky", "", "", "musk, woods"],
  ["Commodity", "Book", "Eau de Parfum", null, "woody", "", "woods", "musk"],
  ["Snif", "Cool Kids", "Eau de Toilette", null, "fresh", "", "", "musk"],
  ["Tocca", "Cleopatra", "Eau de Parfum", 2008, "amber", "citrus", "jasmine", "vanilla, amber"],
  ["Vilhelm Parfumerie", "Mango Skin", "Eau de Parfum", 2018, "fruity", "mango", "florals", "musk, woods"],
  ["Ormonde Jayne", "Ta'if", "Eau de Parfum", 2004, "floral", "pink pepper, saffron", "rose", "amber, dates"],
  ["Floraiku", "Sweet Dreams in Kyoto", "Eau de Parfum", null, "floral", "", "florals", "musk"],
  ["Eris Parfums", "Ma Bête", "Eau de Parfum", 2016, "leather", "spices", "florals", "leather, musk"],
  ["BDK Parfums", "Gris Charnel", "Eau de Parfum", 2019, "woody", "fig, cardamom, black tea", "iris, vetiver", "sandalwood, tonka"],
  ["Essential Parfums", "Bois Impérial", "Eau de Parfum", 2020, "woody", "basil", "vetiver", "akigalawood, woods"],
  ["Goldfield & Banks", "Pacific Rock Moss", "Perfume Concentrate", 2016, "aromatic", "lemon", "sage, moss", "cedar"],
  ["Matiere Premiere", "Radical Rose", "Eau de Parfum", 2019, "floral", "", "rose", "woods, musk"],
  ["The Body Shop", "White Musk", "Eau de Toilette", 1981, "musky", "", "floral notes", "white musk"],
  ["Clean Reserve", "Skin", "Eau de Parfum", null, "musky", "", "", "musk"],
  ["Pacifica", "Tahitian Gardenia", "Perfume", null, "floral", "", "gardenia, coconut", "musk"],
  ["Bath & Body Works", "Warm Vanilla Sugar", "Fine Fragrance Mist", null, "gourmand", "", "vanilla", "sugar, musk"],
  ["Victoria's Secret", "Bombshell", "Eau de Parfum", 2010, "fruity", "passion fruit, grapefruit", "peony, vanilla orchid", "musk, woods"],
  ["Britney Spears", "Fantasy", "Eau de Parfum", 2005, "gourmand", "lychee, kiwi", "white chocolate, jasmine", "musk, woods"],
  ["Zara", "Red Temptation", "Eau de Parfum", null, "amber", "", "", "amber, vanilla"],
  ["Demeter", "Paperback", "Cologne Spray", null, "woody", "", "paper accord", "woods, musk"],
  ["Philosophy", "Amazing Grace", "Eau de Toilette", 1997, "musky", "bergamot", "florals", "musk"],
  ["Elizabeth and James", "Nirvana Black", "Eau de Parfum", 2013, "woody", "", "violet", "sandalwood, vanilla, musk"],
  ["Maison Margiela", "Replica When the Rain Stops", "Eau de Toilette", 2017, "fresh", "bergamot", "aquatic notes, rose", "moss, patchouli"],
  ["Tom Ford", "Ébène Fumé", "Eau de Parfum", 2021, "woody", "pink pepper", "palo santo, incense", "ebony wood, leather"],
  ["Le Labo", "Gaiac 10", "Eau de Parfum", 2010, "woody", "", "guaiac wood", "musk, cedar"],
  ["Chanel", "Les Exclusifs 31 Rue Cambon", "Eau de Parfum", 2007, "chypre", "pepper, bergamot", "iris, jasmine", "patchouli, labdanum"],
  ["Guerlain", "Insolence", "Eau de Parfum", 2008, "floral", "red berries", "violet, iris", "tonka, musk"],
  ["Dior", "Hypnotic Poison", "Eau de Parfum", 2010, "amber", "almond", "jasmine", "vanilla, musk"],
  ["Yves Saint Laurent", "Paris", "Eau de Toilette", 1983, "floral", "mimosa", "rose, violet", "sandalwood, musk"],
  ["Hermès", "Galop d'Hermès", "Parfum", 2016, "leather", "quince", "rose", "leather"],
  ["Byredo", "Super Cedar", "Eau de Parfum", 2016, "woody", "pink pepper", "cedar", "musk, vetiver"],
  ["Diptyque", "Eau Duelle", "Eau de Toilette", 2010, "amber", "spices", "black tea", "vanilla, incense"],
  ["Maison Francis Kurkdjian", "À la rose", "Eau de Parfum", 2014, "floral", "bergamot, orange", "rose", "cedar, musk"],
  ["Frédéric Malle", "Bigarade Concentrée", "Eau de Parfum", 2002, "citrus", "bitter orange, grapefruit", "rose, black pepper", "cedar, hay"],
  ["Serge Lutens", "Santal Majuscule", "Eau de Parfum", 2012, "woody", "", "rose, cacao", "sandalwood"],
  ["Kilian", "Straight to Heaven", "Eau de Parfum", 2007, "amber", "rum", "patchouli, cedar", "vanilla, amber"],
  ["Jo Malone London", "Blackberry & Bay", "Cologne", 2012, "fruity", "grapefruit", "blackberry, bay leaf", "cedar, woods"],
  ["Creed", "Royal Oud", "Eau de Parfum", 2011, "woody", "lemon, pink pepper, bergamot", "cedar", "oud, sandalwood, musk"],
  ["Parfums de Marly", "Oriana", "Eau de Parfum", 2023, "gourmand", "red fruits", "florals", "vanilla, musk"]
];
// Rows above are the original starter list. More rows are added by js/catalog/*.js.
window.CATALOG_ORIGINAL_COUNT = window.CATALOG_SEED.length;
window.addCatalog = (rows) => rows.forEach((r) => window.CATALOG_SEED.push(r));

// Name-only entries (family, notes and perfumer to be filled in later by members/admins):
//   addNames("Brand", "EDP", ["Name", "Name|EDT", "Name|P|2015"])  → name | concentration code | year
// Codes: EDP, EDT, P (Parfum), EX (Extrait de Parfum), EDC (Eau de Cologne), C (Cologne),
//        CI (Cologne Intense), OIL (Perfume Oil / Attar), MIST (Fine Fragrance Mist), PM (Perfume Mist), PC (Perfume Concentrate)
window.CONCENTRATION_CODES = { EDP: "Eau de Parfum", EDT: "Eau de Toilette", P: "Parfum", EX: "Extrait de Parfum", EDC: "Eau de Cologne", C: "Cologne", CI: "Cologne Intense", OIL: "Perfume Oil / Attar", MIST: "Fine Fragrance Mist", PM: "Perfume Mist", PC: "Perfume Concentrate" };
window.addNames = (brand, conc, list) => window.addCatalog(list.map((e) => {
  const [n, c, y] = e.split("|");
  const code = c || conc;
  return [brand, n.trim(), window.CONCENTRATION_CODES[code] || code, y ? Number(y) : null, null, "", "", ""];
}));
