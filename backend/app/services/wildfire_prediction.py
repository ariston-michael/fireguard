def wildfire_risk(temp,humidity,wind):

 score=0

 if temp>30:
  score+=3

 if humidity<20:
  score+=3

 if wind>20:
  score+=2

 return score